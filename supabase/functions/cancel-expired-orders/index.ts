// Supabase Edge Function: Cancel Expired Payment Orders
// This function runs on a schedule (cron) to automatically cancel orders
// where the payment timer has expired (15 minutes)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
    menu_id: string
    quantity: number
}

interface ExpiredOrder {
    id: string
    batch_id: string
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client with service role key
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Find all expired orders (payment_started_at + 15 min < now)
        //    AND no payment_proof uploaded
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        const { data: expiredOrders, error: fetchError } = await supabase
            .from('orders')
            .select('id, batch_id')
            .eq('status', 'pending_payment')
            .not('payment_started_at', 'is', null)
            .lt('payment_started_at', fifteenMinutesAgo)

        if (fetchError) {
            console.error('Error fetching expired orders:', fetchError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch expired orders' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!expiredOrders || expiredOrders.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No expired orders found', cancelled: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Filter out orders that have payment proofs uploaded
        const ordersToCancel: ExpiredOrder[] = []

        for (const order of expiredOrders) {
            const { data: proofData } = await supabase
                .from('payment_proofs')
                .select('id')
                .eq('order_id', order.id)
                .single()

            // Only cancel if no payment proof exists
            if (!proofData) {
                ordersToCancel.push(order)
            }
        }

        if (ordersToCancel.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No orders to cancel (all have proofs)', cancelled: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Cancel each order and restore stock
        const cancelledOrders: string[] = []

        for (const order of ordersToCancel) {
            try {
                // Get order items
                const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('menu_id, quantity')
                    .eq('order_id', order.id) as { data: OrderItem[] | null }

                // Restore stock for each item
                if (orderItems && order.batch_id) {
                    for (const item of orderItems) {
                        await supabase.rpc('restore_stock', {
                            p_batch_id: order.batch_id,
                            p_menu_id: item.menu_id,
                            p_quantity: item.quantity
                        })
                    }
                }

                // Delete payment proof if exists (cleanup)
                await supabase.rpc('delete_payment_proof', { p_order_id: order.id })

                // Update order status to cancelled
                await supabase
                    .from('orders')
                    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                    .eq('id', order.id)

                cancelledOrders.push(order.id)
                console.log(`Cancelled expired order: ${order.id}`)
            } catch (err) {
                console.error(`Error cancelling order ${order.id}:`, err)
            }
        }

        return new Response(
            JSON.stringify({
                message: `Cancelled ${cancelledOrders.length} expired orders`,
                cancelled: cancelledOrders.length,
                orderIds: cancelledOrders
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        console.error('Unexpected error:', err)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

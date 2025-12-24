// Supabase Edge Function: Generate signed upload URL for payment proofs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()
    const orderId = body?.orderId as string | undefined
    const fileName = body?.fileName as string | undefined
    const fileType = body?.fileType as string | undefined

    if (!orderId || !fileName || !fileType) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId, fileName, or fileType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!ALLOWED_TYPES.has(fileType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status, payment_method, payment_started_at')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.status !== 'pending_payment') {
      return new Response(
        JSON.stringify({ error: 'Order is not pending payment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.payment_method === 'cod' || order.payment_method === 'pending') {
      return new Response(
        JSON.stringify({ error: 'Payment method not eligible for proof upload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.payment_started_at) {
      const startedAt = new Date(order.payment_started_at).getTime()
      const expiresAt = startedAt + 15 * 60 * 1000
      if (Date.now() > expiresAt) {
        return new Response(
          JSON.stringify({ error: 'Payment window expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { data: existingProofs, error: proofError } = await supabase
      .from('payment_proofs')
      .select('id')
      .eq('order_id', orderId)
      .limit(1)

    if (proofError) {
      return new Response(
        JSON.stringify({ error: 'Failed to check payment proofs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existingProofs && existingProofs.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Payment proof already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${orderId}/${Date.now()}-${safeName}`

    const { data: signedData, error: signedError } = await supabase.storage
      .from('payment-proofs')
      .createSignedUploadUrl(filePath)

    if (signedError || !signedData?.signedUrl || !signedData?.token) {
      return new Response(
        JSON.stringify({ error: 'Failed to create signed upload URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        signedUrl: signedData.signedUrl,
        path: signedData.path,
        token: signedData.token,
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

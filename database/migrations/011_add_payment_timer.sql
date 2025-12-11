-- Migration: Add payment timer support
-- Description: Add payment_started_at column and helper function for payment timer feature

-- 1. Add payment_started_at column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_started_at TIMESTAMP WITH TIME ZONE;

-- 2. Create function to delete payment proof for an order
-- Used when customer changes payment method after uploading proof
CREATE OR REPLACE FUNCTION delete_payment_proof(p_order_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete from storage bucket first (if exists)
  -- Note: Storage deletion needs to be handled on frontend/edge function
  
  -- Delete from payment_proofs table
  DELETE FROM public.payment_proofs WHERE order_id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to cancel expired orders (for edge function to call)
CREATE OR REPLACE FUNCTION cancel_expired_payment_orders()
RETURNS TABLE(cancelled_order_id UUID, batch_id UUID) AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  -- Find all expired orders (15 minutes timeout)
  FOR v_order IN 
    SELECT o.id, o.batch_id
    FROM public.orders o
    WHERE o.status = 'pending_payment'
      AND o.payment_started_at IS NOT NULL
      AND o.payment_started_at + INTERVAL '15 minutes' < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_proofs pp WHERE pp.order_id = o.id
      )
  LOOP
    -- Restore stock for each item in the order
    FOR v_item IN 
      SELECT oi.menu_id, oi.quantity 
      FROM public.order_items oi 
      WHERE oi.order_id = v_order.id
    LOOP
      -- Call restore_stock function
      PERFORM restore_stock(v_order.batch_id, v_item.menu_id, v_item.quantity);
    END LOOP;
    
    -- Update order status to cancelled
    UPDATE public.orders 
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_order.id;
    
    -- Return the cancelled order info
    cancelled_order_id := v_order.id;
    batch_id := v_order.batch_id;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permission on new functions
GRANT EXECUTE ON FUNCTION delete_payment_proof(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_expired_payment_orders() TO anon, authenticated;

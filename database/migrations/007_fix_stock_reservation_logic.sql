-- Migration: Fix Stock Reservation Logic
-- The previous version only decremented available stock but failed to increment reserved stock.

create or replace function create_order_atomic(
    p_batch_id uuid,
    p_customer_name text,
    p_customer_phone text,
    p_customer_address text,
    p_total_price numeric,
    p_payment_method text,
    p_items jsonb
) returns uuid as $$
declare
    v_order_id uuid;
    v_item jsonb;
    v_menu_id uuid;
    v_quantity int;
    v_price numeric;
begin
    -- Create order
    insert into public.orders (
        batch_id, customer_name, customer_phone, customer_address,
        total_amount, payment_method, status
    ) values (
        p_batch_id, p_customer_name, p_customer_phone, p_customer_address,
        p_total_price, p_payment_method, 'pending_payment'
    ) returning id into v_order_id;

    -- Process each item
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_menu_id := (v_item->>'menu_id')::uuid;
        v_quantity := (v_item->>'quantity')::int;
        v_price := (v_item->>'price')::numeric;

        -- Create order item
        insert into public.order_items (order_id, menu_id, quantity, price_per_item)
        values (v_order_id, v_menu_id, v_quantity, v_price);

        -- Update stock: reduce available AND increase reserved
        update public.batch_stocks
        set 
            quantity_available = quantity_available - v_quantity,
            quantity_reserved = COALESCE(quantity_reserved, 0) + v_quantity
        where batch_id = p_batch_id and menu_id = v_menu_id;
    end loop;

    return v_order_id;
end;
$$ language plpgsql security definer;

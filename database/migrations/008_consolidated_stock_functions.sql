-- Migration: Consolidated Stock Functions
-- Ensures both create_order_atomic and restore_stock work correctly

-- 1. create_order_atomic: Decreases available, increases reserved
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


-- 2. restore_stock: Called when order is CANCELLED
-- Increases available, decreases reserved (returns stock to pool)
create or replace function restore_stock(
    p_batch_id uuid,
    p_menu_id uuid,
    p_quantity int
) returns void as $$
begin
    update public.batch_stocks
    set
        quantity_available = quantity_available + p_quantity,
        quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - p_quantity)
    where batch_id = p_batch_id and menu_id = p_menu_id;
end;
$$ language plpgsql security definer;


-- 3. release_reservation: Called when order is COMPLETED (picked_up)
-- Only decreases reserved (stock was already sold)
create or replace function release_reservation(
    p_batch_id uuid,
    p_menu_id uuid,
    p_quantity int
) returns void as $$
begin
    update public.batch_stocks
    set quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - p_quantity)
    where batch_id = p_batch_id and menu_id = p_menu_id;
end;
$$ language plpgsql security definer;


-- Grant permissions
grant execute on function create_order_atomic to authenticated, anon;
grant execute on function restore_stock to authenticated, anon;
grant execute on function release_reservation to authenticated, anon;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Menus Table
create table public.menus (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  price decimal(10, 2) not null,
  description text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Batches Table
create table public.batches (
  id uuid default uuid_generate_v4() primary key,
  status text not null check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id), -- Link to admin user
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Batch Stocks Table (Real-time stock tracking)
create table public.batch_stocks (
  id uuid default uuid_generate_v4() primary key,
  batch_id uuid references public.batches(id) on delete cascade not null,
  menu_id uuid references public.menus(id) on delete cascade not null,
  quantity_available integer not null default 0,
  quantity_reserved integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(batch_id, menu_id)
);

-- 4. Payment Settings Table
create table public.payment_settings (
  id uuid default uuid_generate_v4() primary key,
  qris_image_url text,
  bank_name text,
  account_number text,
  account_holder text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Orders Table
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  batch_id uuid references public.batches(id) not null,
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  total_price decimal(10, 2) not null,
  status text not null check (status in ('pending_payment', 'payment_received', 'preparing', 'ready', 'picked_up', 'cancelled')) default 'pending_payment',
  payment_method text not null, -- 'qris', 'transfer', 'cod'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Order Items Table
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_id uuid references public.menus(id) not null,
  quantity integer not null,
  price_per_item decimal(10, 2) not null
);

-- 7. Payment Proofs Table
create table public.payment_proofs (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  file_url text not null,
  file_type text not null,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.menus enable row level security;
alter table public.batches enable row level security;
alter table public.batch_stocks enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.payment_settings enable row level security;

-- Public Read Policies
create policy "Public menus are viewable by everyone" on public.menus for select using (true);
create policy "Public batches are viewable by everyone" on public.batches for select using (true);
create policy "Public batch_stocks are viewable by everyone" on public.batch_stocks for select using (true);
create policy "Public payment_settings are viewable by everyone" on public.payment_settings for select using (true);

-- Admin Full Access Policies (Assuming admin has a specific role or we just allow authenticated for now for simplicity, 
-- but ideally should check for admin role. For MVP, we'll assume authenticated users are admins or we'll add a specific check later.
-- For now, let's allow authenticated users to do everything (Admin) and public to read only (except creating orders).
-- WAIT: Customers need to create orders.
create policy "Customers can create orders" on public.orders for insert with check (true);
create policy "Customers can view their own orders" on public.orders for select using (true); -- Ideally restrict by some token/session, but for MVP public tracking by ID might be needed or we use a secure token.
-- Let's stick to: Public can create orders.
create policy "Public can create order items" on public.order_items for insert with check (true);
create policy "Public can create payment proofs" on public.payment_proofs for insert with check (true);

-- Admin policies (Authenticated)
create policy "Admins can do everything" on public.menus for all using (auth.role() = 'authenticated');
create policy "Admins can do everything on batches" on public.batches for all using (auth.role() = 'authenticated');
create policy "Admins can do everything on batch_stocks" on public.batch_stocks for all using (auth.role() = 'authenticated');
create policy "Admins can view all orders" on public.orders for select using (auth.role() = 'authenticated');
create policy "Admins can update orders" on public.orders for update using (auth.role() = 'authenticated');
create policy "Admins can manage payment settings" on public.payment_settings for all using (auth.role() = 'authenticated');


-- Storage Buckets (You need to create these in the dashboard, but here is the policy logic)
-- Bucket: 'menu-images' (Public read, Admin upload)
-- Bucket: 'payment-proofs' (Public upload, Admin read)

-- Functions

-- Atomic Stock Reservation / Checkout
-- This function should be called when placing an order.
-- It checks if enough stock is available, decrements it, and creates the order.
-- Note: For MVP, we might just decrement 'quantity_available'.
create or replace function create_order_atomic(
  p_batch_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_total_price decimal,
  p_payment_method text,
  p_items jsonb -- Array of {menu_id, quantity, price}
) returns uuid as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_menu_id uuid;
  v_quantity int;
  v_price decimal;
  v_current_stock int;
begin
  -- 1. Create Order
  insert into public.orders (batch_id, customer_name, customer_phone, customer_address, total_price, payment_method)
  values (p_batch_id, p_customer_name, p_customer_phone, p_customer_address, p_total_price, p_payment_method)
  returning id into v_order_id;

  -- 2. Process Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_menu_id := (v_item->>'menu_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;
    v_price := (v_item->>'price')::decimal;

    -- Check and Update Stock
    select quantity_available into v_current_stock
    from public.batch_stocks
    where batch_id = p_batch_id and menu_id = v_menu_id
    for update; -- Lock the row

    if v_current_stock < v_quantity then
      raise exception 'Insufficient stock for menu item %', v_menu_id;
    end if;

    update public.batch_stocks
    set quantity_available = quantity_available - v_quantity
    where batch_id = p_batch_id and menu_id = v_menu_id;

    -- Insert Order Item
    insert into public.order_items (order_id, menu_id, quantity, price_per_item)
    values (v_order_id, v_menu_id, v_quantity, v_price);
  end loop;

  return v_order_id;
end;
$$ language plpgsql;

-- Function to restore stock when order is cancelled
create or replace function restore_stock(
    p_batch_id uuid,
    p_menu_id uuid,
    p_quantity int
) returns void as $$
begin
    update public.batch_stocks
    set quantity_available = quantity_available + p_quantity
    where batch_id = p_batch_id and menu_id = p_menu_id;
end;
$$ language plpgsql security definer;

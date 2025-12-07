-- Updated Schema for TutyJuicy (Current State after Migration 001)
-- This file represents the current database schema including all migrations
-- Use this as a reference for new database setups

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

-- 2. Batches Table (with title and delivery_date columns)
create table public.batches (
  id uuid default uuid_generate_v4() primary key,
  title text default 'Pre-order Batch' not null,
  delivery_date date not null,
  status text not null check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on column public.batches.title is 'Display title for the batch (e.g., "Week 1", "December Batch")';
comment on column public.batches.delivery_date is 'Scheduled delivery date for the batch';

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
  payment_method text not null, -- 'qris', 'transfer', 'cod', 'pending' (updated in migration 001)
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

-- ====================
-- INDEXES (Added in Migration 001)
-- ====================

-- Performance index for admin dashboard filtering by status
CREATE INDEX idx_orders_status ON public.orders(status);

-- Index for batch-related order queries
CREATE INDEX idx_orders_batch_id ON public.orders(batch_id);

-- Index for stock lookup queries
CREATE INDEX idx_batch_stocks_batch_id ON public.batch_stocks(batch_id);

-- Composite index for phone-based order tracking
CREATE INDEX idx_orders_customer_phone_created ON public.orders(customer_phone, created_at DESC);

-- ====================
-- RLS POLICIES
-- ====================

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

-- Customer Policies
create policy "Customers can create orders" on public.orders for insert with check (true);
create policy "Customers can view their own orders" on public.orders for select using (true);
create policy "Public can create order items" on public.order_items for insert with check (true);
create policy "Public can create payment proofs" on public.payment_proofs for insert with check (true);

-- Admin policies (Authenticated)
create policy "Admins can do everything" on public.menus for all using (auth.role() = 'authenticated');
create policy "Admins can do everything on batches" on public.batches for all using (auth.role() = 'authenticated');
create policy "Admins can do everything on batch_stocks" on public.batch_stocks for all using (auth.role() = 'authenticated');
create policy "Admins can view all orders" on public.orders for select using (auth.role() = 'authenticated');
create policy "Admins can update orders" on public.orders for update using (auth.role() = 'authenticated');
create policy "Admins can manage payment settings" on public.payment_settings for all using (auth.role() = 'authenticated');

-- ====================
-- FUNCTIONS
-- ====================

-- Atomic Stock Reservation / Checkout (Updated in Migration 001 to accept 'pending')
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
  -- Validate payment method (includes 'pending' for deferred selection)
  if p_payment_method not in ('qris', 'transfer', 'cod', 'pending') then
    raise exception 'Invalid payment method: %. Must be qris, transfer, cod, or pending', p_payment_method;
  end if;

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

-- ====================
-- STORAGE BUCKETS
-- ====================

-- Note: Storage buckets must be created in Supabase dashboard:
-- Bucket: 'menu-images' (Public read, Admin upload)
-- Bucket: 'payment-proofs' (Public upload, Admin read)

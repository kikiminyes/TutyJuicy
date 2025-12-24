-- Security policies update: admin role checks + safer public access

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or (
      auth.role() = 'authenticated'
      and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );
$$;

-- Menus
alter table public.menus enable row level security;
drop policy if exists "Public menus are viewable by everyone" on public.menus;
drop policy if exists "Admins can do everything" on public.menus;
create policy "public_menus_select" on public.menus for select using (true);
create policy "admin_menus_all" on public.menus for all using (public.is_admin()) with check (public.is_admin());

-- Batches
alter table public.batches enable row level security;
drop policy if exists "Public batches are viewable by everyone" on public.batches;
drop policy if exists "Admins can do everything on batches" on public.batches;
create policy "public_batches_select" on public.batches for select using (true);
create policy "admin_batches_all" on public.batches for all using (public.is_admin()) with check (public.is_admin());

-- Batch stocks
alter table public.batch_stocks enable row level security;
drop policy if exists "Public batch_stocks are viewable by everyone" on public.batch_stocks;
drop policy if exists "Admins can do everything on batch_stocks" on public.batch_stocks;
create policy "public_batch_stocks_select" on public.batch_stocks for select using (true);
create policy "admin_batch_stocks_all" on public.batch_stocks for all using (public.is_admin()) with check (public.is_admin());

-- Payment settings
alter table public.payment_settings enable row level security;
drop policy if exists "Public payment_settings are viewable by everyone" on public.payment_settings;
drop policy if exists "Admins can manage payment settings" on public.payment_settings;
create policy "public_payment_settings_select" on public.payment_settings for select using (true);
create policy "admin_payment_settings_all" on public.payment_settings for all using (public.is_admin()) with check (public.is_admin());

-- Admin contacts (if present)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'admin_contacts' and table_schema = 'public') then
    alter table public.admin_contacts enable row level security;
    drop policy if exists "Public active contacts are viewable by everyone" on public.admin_contacts;
    drop policy if exists "Admins can do everything on admin_contacts" on public.admin_contacts;
    create policy "public_admin_contacts_select" on public.admin_contacts for select using (is_active = true);
    create policy "admin_admin_contacts_all" on public.admin_contacts for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Orders
alter table public.orders enable row level security;
drop policy if exists "Customers can create orders" on public.orders;
drop policy if exists "Customers can view their own orders" on public.orders;
drop policy if exists "Anyone can view orders" on public.orders;
drop policy if exists "Authenticated can delete orders" on public.orders;
drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
create policy "public_orders_select" on public.orders for select using (true);
create policy "public_orders_insert" on public.orders for insert
  with check (
    status = 'pending_payment'
    and payment_method in ('pending', 'qris', 'transfer', 'cod')
  );
create policy "public_orders_update_pending" on public.orders for update
  using (status = 'pending_payment')
  with check (
    status in ('pending_payment', 'cancelled')
    and payment_method in ('pending', 'qris', 'transfer', 'cod')
  );
create policy "admin_orders_all" on public.orders for all
  using (public.is_admin()) with check (public.is_admin());

-- Order items
alter table public.order_items enable row level security;
drop policy if exists "Public can create order items" on public.order_items;
drop policy if exists "Anyone can view order items" on public.order_items;
drop policy if exists "Authenticated can delete order_items" on public.order_items;
create policy "public_order_items_select" on public.order_items for select using (true);
create policy "public_order_items_insert" on public.order_items for insert with check (true);
create policy "admin_order_items_all" on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());

-- Payment proofs
alter table public.payment_proofs enable row level security;
drop policy if exists "Public can create payment proofs" on public.payment_proofs;
drop policy if exists "Anyone can view payment proofs" on public.payment_proofs;
drop policy if exists "Anyone can create payment proofs" on public.payment_proofs;
drop policy if exists "Authenticated can delete payment proofs" on public.payment_proofs;
create policy "public_payment_proofs_select" on public.payment_proofs for select using (true);
create policy "public_payment_proofs_insert" on public.payment_proofs for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = payment_proofs.order_id
        and o.status = 'pending_payment'
        and o.payment_method in ('qris', 'transfer')
    )
  );
create policy "public_payment_proofs_delete_pending" on public.payment_proofs for delete
  using (
    exists (
      select 1
      from public.orders o
      where o.id = payment_proofs.order_id
        and o.status = 'pending_payment'
    )
  );
create policy "admin_payment_proofs_all" on public.payment_proofs for all
  using (public.is_admin()) with check (public.is_admin());

-- Menu images (if present)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'menu_images' and table_schema = 'public') then
    alter table public.menu_images enable row level security;
    drop policy if exists "Allow public read menu_images" on public.menu_images;
    drop policy if exists "Allow admin insert menu_images" on public.menu_images;
    drop policy if exists "Allow admin update menu_images" on public.menu_images;
    drop policy if exists "Allow admin delete menu_images" on public.menu_images;
    create policy "public_menu_images_select" on public.menu_images for select using (true);
    create policy "admin_menu_images_all" on public.menu_images for all
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Waitlist leads (if present)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'waitlist_leads' and table_schema = 'public') then
    alter table public.waitlist_leads enable row level security;
    drop policy if exists "Public can insert waitlist" on public.waitlist_leads;
    drop policy if exists "Admins can view waitlist" on public.waitlist_leads;
    drop policy if exists "Admins can update waitlist" on public.waitlist_leads;
    drop policy if exists "Admins can delete waitlist" on public.waitlist_leads;
    create policy "public_waitlist_insert" on public.waitlist_leads for insert with check (true);
    create policy "admin_waitlist_select" on public.waitlist_leads for select using (public.is_admin());
    create policy "admin_waitlist_update" on public.waitlist_leads for update using (public.is_admin());
    create policy "admin_waitlist_delete" on public.waitlist_leads for delete using (public.is_admin());
  end if;
end $$;

-- Storage: make payment-proofs bucket private if it exists
update storage.buckets
set public = false
where id = 'payment-proofs';

-- Storage policy: allow admin read for payment-proofs
drop policy if exists "admin_payment_proofs_read" on storage.objects;
create policy "admin_payment_proofs_read"
  on storage.objects for select
  using (bucket_id = 'payment-proofs' and public.is_admin());

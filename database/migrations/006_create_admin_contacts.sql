-- Create admin_contacts table
create table public.admin_contacts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone_number text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.admin_contacts enable row level security;

-- Policies
create policy "Public active contacts are viewable by everyone" 
  on public.admin_contacts for select 
  using (is_active = true);

create policy "Admins can do everything on admin_contacts" 
  on public.admin_contacts for all 
  using (auth.role() = 'authenticated');

create extension if not exists "pgcrypto";

do $$ begin create type public.user_role as enum ('customer', 'cook', 'admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cook_status as enum ('pending', 'active', 'paused'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('pending', 'confirmed', 'skipped', 'delivered', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.delivery_mode as enum ('self-pickup', 'cook-delivery', 'platform-delivery'); exception when duplicate_object then null; end $$;
do $$ begin create type public.subscription_status as enum ('active', 'ended', 'cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  role public.user_role not null default 'customer',
  pincode text not null,
  locality text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cook_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  kitchen_photo_url text,
  fssai_tier text not null,
  hygiene_checklist jsonb not null default '{}'::jsonb,
  daily_capacity integer not null check (daily_capacity between 1 and 20),
  rating_avg numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  status public.cook_status not null default 'pending',
  self_delivery_fee integer not null default 0 check (self_delivery_fee >= 0),
  self_delivery_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  locality text not null,
  pincode text not null,
  has_platform_delivery boolean not null default false,
  assigned_partner_id uuid,
  delivery_fee integer not null default 0 check (delivery_fee >= 0)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  cook_id uuid not null references public.cook_profiles(id),
  plan_type text not null check (plan_type in ('weekly', 'monthly')),
  meal_type text not null check (meal_type in ('lunch', 'dinner')),
  start_date date not null,
  end_date date not null,
  status public.subscription_status not null default 'active',
  paused_days date[] not null default '{}',
  delivery_mode public.delivery_mode not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  cook_id uuid not null references public.cook_profiles(id),
  customer_id uuid not null references public.profiles(id),
  delivery_date date not null,
  meal_type text not null check (meal_type in ('lunch', 'dinner')),
  status public.order_status not null default 'pending',
  delivery_zone_id uuid references public.delivery_zones(id),
  handover_code_hash text not null,
  handover_confirmed_at timestamptz,
  unique (subscription_id, delivery_date, meal_type)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id),
  amount integer not null check (amount >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  cook_payout integer not null default 0 check (cook_payout >= 0),
  status text not null default 'pending' check (status in ('pending', 'released', 'failed'))
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  customer_id uuid not null references public.profiles(id),
  cook_id uuid not null references public.cook_profiles(id),
  stars integer not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists orders_cook_date_idx on public.orders (cook_id, delivery_date, status);
create index if not exists orders_customer_date_idx on public.orders (customer_id, delivery_date);
create index if not exists subscriptions_cook_status_idx on public.subscriptions (cook_id, status);
create index if not exists delivery_zones_pincode_idx on public.delivery_zones (pincode);

do $$
declare
  role_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into role_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles'
    and a.attname = 'role' and not a.attisdropped;

  if role_type = 'public.cook_status' then
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type public.user_role
      using case role::text
        when 'active' then 'cook'::public.user_role
        when 'pending' then 'customer'::public.user_role
        when 'paused' then 'customer'::public.user_role
        else role::text::public.user_role
      end;
  end if;

  alter table public.profiles alter column role set default 'customer'::public.user_role;
end $$;

alter table public.profiles enable row level security;
alter table public.cook_profiles enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.ratings enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "customers read active cooks" on public.cook_profiles;
create policy "customers read active cooks" on public.cook_profiles for select using (status = 'active' or user_id = auth.uid());
drop policy if exists "users read zones" on public.delivery_zones;
create policy "users read zones" on public.delivery_zones for select using (true);
drop policy if exists "customers read own subscriptions" on public.subscriptions;
create policy "customers read own subscriptions" on public.subscriptions for select using (customer_id = auth.uid());
drop policy if exists "cooks read their subscriptions" on public.subscriptions;
create policy "cooks read their subscriptions" on public.subscriptions for select using (cook_id in (select id from public.cook_profiles where user_id = auth.uid()));
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders for select using (customer_id = auth.uid());
drop policy if exists "cooks read their orders" on public.orders;
create policy "cooks read their orders" on public.orders for select using (cook_id in (select id from public.cook_profiles where user_id = auth.uid()));
drop policy if exists "customers read own payments" on public.payments;
create policy "customers read own payments" on public.payments for select using (subscription_id in (select id from public.subscriptions where customer_id = auth.uid()));
drop policy if exists "cooks read own payouts" on public.payments;
create policy "cooks read own payouts" on public.payments for select using (subscription_id in (select id from public.subscriptions where cook_id in (select id from public.cook_profiles where user_id = auth.uid())));
drop policy if exists "customers create ratings for own orders" on public.ratings;
create policy "customers create ratings for own orders" on public.ratings for insert with check (customer_id = auth.uid() and order_id in (select id from public.orders where customer_id = auth.uid() and status = 'delivered'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage cooks" on public.cook_profiles;
create policy "admins manage cooks" on public.cook_profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage zones" on public.delivery_zones;
create policy "admins manage zones" on public.delivery_zones for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage subscriptions" on public.subscriptions;
create policy "admins manage subscriptions" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments" on public.payments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage ratings" on public.ratings;
create policy "admins manage ratings" on public.ratings for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.create_subscription_with_capacity(customer uuid, payload jsonb)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  cook_row public.cook_profiles;
  result public.subscriptions;
  active_count integer;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  select count(*) into active_count from public.subscriptions where cook_id = cook_row.id and status = 'active';
  if active_count + 1 > cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  insert into public.subscriptions (customer_id, cook_id, plan_type, meal_type, start_date, end_date, delivery_mode)
  values (customer, cook_row.id, payload->>'plan_type', payload->>'meal_type', (payload->>'start_date')::date, (payload->>'end_date')::date, (payload->>'delivery_mode')::public.delivery_mode)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.create_subscription_with_capacity(uuid, jsonb) from public;
grant execute on function public.create_subscription_with_capacity(uuid, jsonb) to authenticated;

create or replace function public.confirm_handover(order_id uuid, submitted_code text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders;
begin
  select * into target from public.orders where id = order_id for update;
  if target.id is null then raise exception 'Order not found'; end if;
  if not exists (select 1 from public.cook_profiles where id = target.cook_id and user_id = auth.uid()) then
    raise exception 'Only the assigned cook can confirm this order';
  end if;
  if target.status <> 'pending' then raise exception 'Order is not pending'; end if;
  if target.handover_code_hash <> crypt(submitted_code, target.handover_code_hash) then raise exception 'Invalid handover code'; end if;
  update public.orders set status = 'delivered', handover_confirmed_at = now() where id = target.id returning * into target;
  return target;
end;
$$;

revoke all on function public.confirm_handover(uuid, text) from public;
grant execute on function public.confirm_handover(uuid, text) to authenticated;
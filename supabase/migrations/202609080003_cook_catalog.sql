alter table public.cook_profiles
  add column if not exists display_name text not null default 'Home kitchen',
  add column if not exists tagline text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists pincodes text[] not null default '{}',
  add column if not exists veg_type text not null default 'mixed',
  add column if not exists price_per_meal integer not null default 0 check (price_per_meal >= 0),
  add column if not exists weekly_price integer not null default 0 check (weekly_price >= 0),
  add column if not exists monthly_price integer not null default 0 check (monthly_price >= 0),
  add column if not exists fssai_number text not null default '',
  add column if not exists rating_count integer not null default 0 check (rating_count >= 0),
  add column if not exists weekly_menu jsonb not null default '[]'::jsonb,
  add column if not exists active_subscribers integer not null default 0 check (active_subscribers >= 0);
alter table public.cook_profiles add column if not exists zone_id uuid references public.delivery_zones(id);

create policy "cooks create own profile" on public.cook_profiles for insert
  with check (user_id = auth.uid());
create policy "cooks update own profile" on public.cook_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "customers create subscriptions" on public.subscriptions for insert
  with check (customer_id = auth.uid());
create policy "customers update own subscriptions" on public.subscriptions for update
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
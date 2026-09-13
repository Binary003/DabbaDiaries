-- Persist admin cook verification decisions and keep admin realtime reads covered.

do $$
begin
  alter type public.cook_status add value if not exists 'rejected';
exception
  when duplicate_object then null;
end $$;

alter table public.cook_profiles
  add column if not exists rejection_reason text;

drop policy if exists "admins manage cooks" on public.cook_profiles;
create policy "admins manage cooks" on public.cook_profiles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments" on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read transfers" on public.transfers;
create policy "admins read transfers" on public.transfers
  for select using (public.is_admin());

drop policy if exists "admins read refunds" on public.refunds;
create policy "admins read refunds" on public.refunds
  for select using (public.is_admin());

drop policy if exists "cooks read customer profiles for orders" on public.profiles;
create policy "cooks read customer profiles for orders" on public.profiles
  for select using (exists (
    select 1 from public.orders
    where orders.customer_id = profiles.id
      and orders.cook_id in (select id from public.cook_profiles where user_id = auth.uid())
  ));

-- Admin operations depend on live cook and order updates.
do $$
begin
  alter publication supabase_realtime add table public.cook_profiles;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.payments, public.transfers, public.refunds;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admins read transfers" on public.transfers for select using (public.is_admin());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "admins read refunds" on public.refunds for select using (public.is_admin());
exception
  when duplicate_object then null;
end $$;
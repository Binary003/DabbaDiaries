-- Mock Razorpay Route-shaped payment model.
-- Legacy wallet tables are intentionally retained but disconnected and cleared below.
-- All provider behavior is mocked here until the real account/API is available.

update public.wallets set balance = 0;
delete from public.wallet_transactions;

alter table public.payments alter column subscription_id drop not null;
alter table public.payments add column if not exists customer_id uuid references public.profiles(id);
alter table public.payments add column if not exists description text;
alter table public.payments add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.payments drop constraint if exists payments_status_check;
  alter table public.payments add constraint payments_status_check check (status in ('created', 'refunded', 'pending', 'released', 'failed'));
exception when duplicate_object then null; end $$;

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  cook_id uuid not null references public.cook_profiles(id),
  order_id uuid references public.orders(id) on delete set null,
  amount integer not null check (amount >= 0),
  status text not null default 'on_hold' check (status in ('on_hold', 'released')),
  hold_until timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount integer not null check (amount >= 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cook_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null unique references public.cook_profiles(id) on delete cascade,
  account_type text not null check (account_type in ('upi', 'bank')),
  upi_id text,
  account_number text,
  ifsc text,
  provider_account_id text,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists handover_code text;
alter table public.orders add column if not exists payment_id uuid references public.payments(id);

do $$ begin
  create policy "customers read own provider payments" on public.payments for select using (customer_id = auth.uid());
exception when duplicate_object then null; end $$;

alter table public.transfers enable row level security;
alter table public.refunds enable row level security;
alter table public.cook_payout_accounts enable row level security;
do $$ begin
  create policy "customers read own payment transfers" on public.transfers for select using (payment_id in (select id from public.payments where customer_id = auth.uid()) or cook_id in (select id from public.cook_profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customers read own refunds" on public.refunds for select using (payment_id in (select id from public.payments where customer_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cooks manage own payout account" on public.cook_payout_accounts for all using (cook_id in (select id from public.cook_profiles where user_id = auth.uid())) with check (cook_id in (select id from public.cook_profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

create or replace function public.mock_create_payment(customer uuid, payment_amount integer, payment_description text)
returns public.payments language plpgsql security definer set search_path = public as $$
declare result public.payments;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  if payment_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  insert into public.payments (customer_id, amount, description, status) values (customer, payment_amount, payment_description, 'created') returning * into result;
  return result;
end; $$;

create or replace function public.mock_create_transfer(payment uuid, cook uuid, transfer_amount integer, transfer_hold_until timestamptz default null, transfer_order uuid default null)
returns public.transfers language plpgsql security definer set search_path = public as $$
declare result public.transfers;
begin
  if not exists (select 1 from public.payments where id = payment and customer_id = auth.uid()) then raise exception 'Payment not found'; end if;
  if transfer_amount <= 0 then raise exception 'Transfer amount must be positive'; end if;
  insert into public.transfers (payment_id, cook_id, order_id, amount, hold_until) values (payment, cook, transfer_order, transfer_amount, transfer_hold_until) returning * into result;
  return result;
end; $$;

create or replace function public.mock_release_transfer(transfer uuid)
returns public.transfers language plpgsql security definer set search_path = public as $$
declare target public.transfers; result public.transfers;
begin
  select * into target from public.transfers where id = transfer for update;
  if target.id is null then raise exception 'Transfer not found'; end if;
  if not exists (select 1 from public.cook_profiles where id = target.cook_id and user_id = auth.uid()) then raise exception 'Only the assigned cook can release this transfer'; end if;
  update public.transfers set status = 'released', released_at = now() where id = transfer returning * into result;
  return result;
end; $$;

create or replace function public.mock_refund_payment(payment uuid, refund_amount integer, refund_reason text)
returns public.refunds language plpgsql security definer set search_path = public as $$
declare result public.refunds;
begin
  if not exists (select 1 from public.payments where id = payment and customer_id = auth.uid()) then raise exception 'Payment not found'; end if;
  insert into public.refunds (payment_id, amount, reason) values (payment, refund_amount, refund_reason) returning * into result;
  update public.payments set status = 'refunded' where id = payment;
  return result;
end; $$;

create or replace function public.mock_register_cook_payout_account(cook uuid, payout jsonb)
returns public.cook_payout_accounts language plpgsql security definer set search_path = public as $$
declare result public.cook_payout_accounts; account_kind text;
begin
  if not exists (select 1 from public.cook_profiles where id = cook and user_id = auth.uid()) then raise exception 'Cook account not found'; end if;
  account_kind := case when nullif(payout->>'upiId', '') is not null then 'upi' else 'bank' end;
  insert into public.cook_payout_accounts (cook_id, account_type, upi_id, account_number, ifsc, provider_account_id)
  values (cook, account_kind, nullif(payout->>'upiId', ''), nullif(payout->>'accountNumber', ''), nullif(payout->>'ifsc', ''), 'mock-linked-' || gen_random_uuid())
  on conflict (cook_id) do update set account_type = excluded.account_type, upi_id = excluded.upi_id, account_number = excluded.account_number, ifsc = excluded.ifsc, provider_account_id = excluded.provider_account_id
  returning * into result;
  return result;
end; $$;

create or replace function public.mock_cancel_subscription(target_subscription_id uuid, refund_amount integer)
returns public.refunds language plpgsql security definer set search_path = public as $$
declare payment uuid; result public.refunds;
begin
  select o.payment_id into payment from public.orders o where o.subscription_id = target_subscription_id and o.customer_id = auth.uid() limit 1;
  if payment is null then raise exception 'Subscription payment not found'; end if;
  update public.subscriptions set status = 'cancelled' where id = target_subscription_id and customer_id = auth.uid();
  insert into public.refunds (payment_id, amount, reason) values (payment, refund_amount, 'Subscription cancelled; remaining held days refunded') returning * into result;
  update public.payments set status = 'refunded' where id = payment;
  return result;
end; $$;

revoke all on function public.mock_create_payment(uuid, integer, text) from public;
revoke all on function public.mock_create_transfer(uuid, uuid, integer, timestamptz, uuid) from public;
revoke all on function public.mock_release_transfer(uuid) from public;
revoke all on function public.mock_refund_payment(uuid, integer, text) from public;
revoke all on function public.mock_register_cook_payout_account(uuid, jsonb) from public;
revoke all on function public.mock_cancel_subscription(uuid, integer) from public;
grant execute on function public.mock_create_payment(uuid, integer, text) to authenticated;
grant execute on function public.mock_create_transfer(uuid, uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.mock_release_transfer(uuid) to authenticated;
grant execute on function public.mock_refund_payment(uuid, integer, text) to authenticated;
grant execute on function public.mock_register_cook_payout_account(uuid, jsonb) to authenticated;
grant execute on function public.mock_cancel_subscription(uuid, integer) to authenticated;

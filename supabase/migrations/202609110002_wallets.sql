do $$ begin create type public.wallet_transaction_type as enum ('topup', 'subscription_debit', 'single_order_debit', 'meal_release'); exception when duplicate_object then null; end $$;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type public.wallet_transaction_type not null,
  amount numeric(12,2) not null check (amount >= 0),
  related_subscription_id uuid references public.subscriptions(id) on delete set null,
  related_order_id uuid references public.orders(id) on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_recent_idx on public.wallet_transactions (wallet_id, created_at desc);
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
drop policy if exists "users read own wallet" on public.wallets;
create policy "users read own wallet" on public.wallets for select using (user_id = auth.uid());
drop policy if exists "users read own wallet transactions" on public.wallet_transactions;
create policy "users read own wallet transactions" on public.wallet_transactions for select using (wallet_id in (select id from public.wallets where user_id = auth.uid()));

create or replace function public.ensure_wallet(customer uuid)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare result public.wallets;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  insert into public.wallets (user_id) values (customer) on conflict (user_id) do nothing;
  select * into result from public.wallets where user_id = customer;
  return result;
end;
$$;

create or replace function public.top_up_wallet(customer uuid, topup_amount numeric)
returns public.wallets language plpgsql security definer set search_path = public as $$
declare wallet_row public.wallets; result public.wallets;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  if topup_amount < 1 or topup_amount > 100000 then raise exception 'Top-up must be between 1 and 100000'; end if;
  insert into public.wallets (user_id) values (customer) on conflict (user_id) do nothing;
  select * into wallet_row from public.wallets where user_id = customer for update;
  -- REAL PAYMENT INTEGRATION: verify the Razorpay webhook before crediting this balance.
  update public.wallets set balance = balance + topup_amount, updated_at = now() where id = wallet_row.id returning * into result;
  insert into public.wallet_transactions (wallet_id, type, amount, description) values (wallet_row.id, 'topup', topup_amount, 'Prototype wallet top-up');
  return result;
end;
$$;

create or replace function public.create_subscription_with_wallet(customer uuid, payload jsonb)
returns public.subscriptions language plpgsql security definer set search_path = public as $$
declare cook_row public.cook_profiles; wallet_row public.wallets; result public.subscriptions; active_count integer; plan_days integer; meal_price integer; plan_amount numeric; debit_amount numeric;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  -- REAL PAYMENT INTEGRATION: require verified Razorpay payment confirmation before the debit.
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  plan_days := case when payload->>'plan_type' = 'weekly' then 7 when payload->>'plan_type' = 'monthly' then 30 else 0 end;
  if plan_days = 0 then raise exception 'Invalid plan'; end if;
  select count(*) into active_count from public.subscriptions where cook_id = cook_row.id and status = 'active';
  if active_count + 1 > cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  insert into public.wallets (user_id) values (customer) on conflict (user_id) do nothing;
  select * into wallet_row from public.wallets where user_id = customer for update;
  plan_amount := coalesce((payload->>'plan_amount')::numeric, case when plan_days = 7 then cook_row.weekly_price else cook_row.monthly_price end);
  debit_amount := plan_amount;
  if wallet_row.balance < debit_amount then raise exception 'INSUFFICIENT_WALLET_BALANCE:%', debit_amount - wallet_row.balance; end if;
  meal_price := coalesce((payload->>'price_per_meal')::integer, cook_row.price_per_meal);
  insert into public.subscriptions (customer_id, cook_id, plan_type, meal_type, start_date, end_date, delivery_mode, amount_paid, total_days, price_per_meal)
  values (customer, cook_row.id, payload->>'plan_type', payload->>'meal_type', (payload->>'start_date')::date, (payload->>'end_date')::date, (payload->>'delivery_mode')::public.delivery_mode, plan_amount, plan_days, meal_price)
  returning * into result;
  update public.wallets set balance = balance - debit_amount, updated_at = now() where id = wallet_row.id;
  insert into public.wallet_transactions (wallet_id, type, amount, related_subscription_id, description) values (wallet_row.id, 'subscription_debit', debit_amount, result.id, 'Subscription plan debit');
  return result;
end;
$$;

create or replace function public.create_single_order_with_wallet(customer uuid, payload jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare cook_row public.cook_profiles; wallet_row public.wallets; result public.orders; current_count integer; meal_price numeric; order_date date;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  -- REAL PAYMENT INTEGRATION: require verified Razorpay payment confirmation before the debit.
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  order_date := greatest(current_date, coalesce((payload->>'delivery_date')::date, current_date));
  select count(*) into current_count from public.orders where cook_id = cook_row.id and delivery_date = order_date and status in ('pending', 'confirmed');
  if current_count >= cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  insert into public.wallets (user_id) values (customer) on conflict (user_id) do nothing;
  select * into wallet_row from public.wallets where user_id = customer for update;
  meal_price := coalesce((payload->>'meal_price')::numeric, cook_row.price_per_meal);
  if wallet_row.balance < meal_price then raise exception 'INSUFFICIENT_WALLET_BALANCE:%', meal_price - wallet_row.balance; end if;
  insert into public.orders (subscription_id, order_type, cook_id, customer_id, delivery_date, meal_type, status, handover_code_hash, meal_price, delivery_mode)
  values (null, 'single', cook_row.id, customer, order_date, payload->>'meal_type', 'pending', crypt(payload->>'handover_code', gen_salt('bf')), meal_price, (payload->>'delivery_mode')::public.delivery_mode)
  returning * into result;
  update public.wallets set balance = balance - meal_price, updated_at = now() where id = wallet_row.id;
  insert into public.wallet_transactions (wallet_id, type, amount, related_order_id, description) values (wallet_row.id, 'single_order_debit', meal_price, result.id, 'Single-day tiffin debit');
  return result;
end;
$$;

create or replace function public.confirm_handover(order_id uuid, submitted_code text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare target public.orders; wallet_row public.wallets;
begin
  select * into target from public.orders where id = order_id for update;
  if target.id is null then raise exception 'Order not found'; end if;
  if not exists (select 1 from public.cook_profiles where id = target.cook_id and user_id = auth.uid()) then raise exception 'Only the assigned cook can confirm this order'; end if;
  if target.status <> 'pending' then raise exception 'Order is not pending'; end if;
  if target.handover_code_hash <> crypt(submitted_code, target.handover_code_hash) then raise exception 'Invalid handover code'; end if;
  update public.orders set status = 'delivered', handover_confirmed_at = now() where id = target.id returning * into target;
  if target.subscription_id is not null then
    select * into wallet_row from public.wallets where user_id = target.customer_id;
    if wallet_row.id is not null then insert into public.wallet_transactions (wallet_id, type, amount, related_subscription_id, related_order_id, description) values (wallet_row.id, 'meal_release', 0, target.subscription_id, target.id, 'Subscription meal delivered'); end if;
  end if;
  return target;
end;
$$;

revoke all on function public.ensure_wallet(uuid) from public;
revoke all on function public.top_up_wallet(uuid, numeric) from public;
revoke all on function public.create_subscription_with_wallet(uuid, jsonb) from public;
revoke all on function public.create_single_order_with_wallet(uuid, jsonb) from public;
revoke all on function public.confirm_handover(uuid, text) from public;
grant execute on function public.ensure_wallet(uuid) to authenticated;
grant execute on function public.top_up_wallet(uuid, numeric) to authenticated;
grant execute on function public.create_subscription_with_wallet(uuid, jsonb) to authenticated;
grant execute on function public.create_single_order_with_wallet(uuid, jsonb) to authenticated;
grant execute on function public.confirm_handover(uuid, text) to authenticated;

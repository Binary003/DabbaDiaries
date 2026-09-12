-- Correct wallet totals: meal price + platform fee + delivery fee, atomically.
-- REAL PAYMENT INTEGRATION: replace prototype wallet credits/debits with verified Razorpay webhooks before launch.

create or replace function public.create_subscription_with_wallet(customer uuid, payload jsonb)
returns public.subscriptions
language plpgsql security definer set search_path = public as $$
declare
  cook_row public.cook_profiles;
  wallet_row public.wallets;
  result public.subscriptions;
  active_count integer;
  plan_days integer;
  meal_price numeric;
  platform_fee numeric;
  delivery_fee numeric;
  meal_total numeric;
  debit_amount numeric;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  plan_days := case when payload->>'plan_type' = 'weekly' then 7 when payload->>'plan_type' = 'monthly' then 30 else 0 end;
  if plan_days = 0 then raise exception 'Invalid plan'; end if;
  select count(*) into active_count from public.subscriptions where cook_id = cook_row.id and status = 'active';
  if active_count + 1 > cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;

  meal_price := coalesce((payload->>'price_per_meal')::numeric, cook_row.price_per_meal);
  platform_fee := coalesce((payload->>'platform_fee_per_meal')::numeric, 15);
  delivery_fee := coalesce((payload->>'delivery_fee')::numeric, 0);
  meal_total := meal_price * plan_days;
  debit_amount := meal_total + (platform_fee * plan_days) + (delivery_fee * plan_days);

  insert into public.wallets (user_id) values (customer) on conflict (user_id) do nothing;
  select * into wallet_row from public.wallets where user_id = customer for update;
  if wallet_row.balance < debit_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE:%', debit_amount - wallet_row.balance;
  end if;

  insert into public.subscriptions (customer_id, cook_id, plan_type, meal_type, start_date, end_date, delivery_mode, amount_paid, total_days, price_per_meal)
  values (customer, cook_row.id, payload->>'plan_type', payload->>'meal_type', (payload->>'start_date')::date, (payload->>'end_date')::date, (payload->>'delivery_mode')::public.delivery_mode, debit_amount, plan_days, meal_price)
  returning * into result;
  update public.wallets set balance = balance - debit_amount, updated_at = now() where id = wallet_row.id;
  insert into public.wallet_transactions (wallet_id, type, amount, related_subscription_id, description)
  values (wallet_row.id, 'subscription_debit', debit_amount, result.id,
    json_build_object('kind', 'subscription', 'mealPricePerMeal', meal_price, 'planDays', plan_days, 'mealTotal', meal_total, 'platformFeePerMeal', platform_fee, 'platformFeeTotal', platform_fee * plan_days, 'deliveryFeePerMeal', delivery_fee, 'deliveryFeeTotal', delivery_fee * plan_days, 'total', debit_amount)::text);
  return result;
end;
$$;

create or replace function public.create_single_order_with_wallet(customer uuid, payload jsonb)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  cook_row public.cook_profiles;
  wallet_row public.wallets;
  result public.orders;
  current_count integer;
  meal_price numeric;
  platform_fee numeric;
  delivery_fee numeric;
  debit_amount numeric;
  order_date date;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  order_date := greatest(current_date, coalesce((payload->>'delivery_date')::date, current_date));
  select count(*) into current_count from public.orders where cook_id = cook_row.id and delivery_date = order_date and status in ('pending', 'confirmed');
  if current_count >= cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;

  meal_price := coalesce((payload->>'meal_price')::numeric, cook_row.price_per_meal);
  platform_fee := coalesce((payload->>'platform_fee')::numeric, 15);
  delivery_fee := coalesce((payload->>'delivery_fee')::numeric, 0);
  debit_amount := meal_price + platform_fee + delivery_fee;

  insert into public.wallets (user_id) values (customer) on conflict (user_id) do nothing;
  select * into wallet_row from public.wallets where user_id = customer for update;
  if wallet_row.balance < debit_amount then
    raise exception 'INSUFFICIENT_WALLET_BALANCE:%', debit_amount - wallet_row.balance;
  end if;

  insert into public.orders (subscription_id, order_type, cook_id, customer_id, delivery_date, meal_type, status, handover_code_hash, meal_price, delivery_mode)
  values (null, 'single', cook_row.id, customer, order_date, payload->>'meal_type', 'pending', crypt(payload->>'handover_code', gen_salt('bf')), meal_price, (payload->>'delivery_mode')::public.delivery_mode)
  returning * into result;
  update public.wallets set balance = balance - debit_amount, updated_at = now() where id = wallet_row.id;
  insert into public.wallet_transactions (wallet_id, type, amount, related_order_id, description)
  values (wallet_row.id, 'single_order_debit', debit_amount, result.id,
    json_build_object('kind', 'single_order', 'mealPrice', meal_price, 'platformFee', platform_fee, 'deliveryFee', delivery_fee, 'total', debit_amount)::text);
  return result;
end;
$$;

revoke all on function public.create_subscription_with_wallet(uuid, jsonb) from public;
revoke all on function public.create_single_order_with_wallet(uuid, jsonb) from public;
grant execute on function public.create_subscription_with_wallet(uuid, jsonb) to authenticated;
grant execute on function public.create_single_order_with_wallet(uuid, jsonb) to authenticated;

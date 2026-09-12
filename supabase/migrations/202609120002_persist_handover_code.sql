-- Demo-grade persistence for the customer-facing handover code.
-- Keep handover_code_hash as the verification source; replace plaintext storage with a secure delivery channel before launch.

alter table public.orders add column if not exists handover_code text;

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
  if wallet_row.balance < debit_amount then raise exception 'INSUFFICIENT_WALLET_BALANCE:%', debit_amount - wallet_row.balance; end if;

  insert into public.orders (subscription_id, order_type, cook_id, customer_id, delivery_date, meal_type, status, handover_code, handover_code_hash, meal_price, delivery_mode)
  values (null, 'single', cook_row.id, customer, order_date, payload->>'meal_type', 'pending', payload->>'handover_code', crypt(payload->>'handover_code', gen_salt('bf')), meal_price, (payload->>'delivery_mode')::public.delivery_mode)
  returning * into result;
  update public.wallets set balance = balance - debit_amount, updated_at = now() where id = wallet_row.id;
  insert into public.wallet_transactions (wallet_id, type, amount, related_order_id, description)
  values (wallet_row.id, 'single_order_debit', debit_amount, result.id,
    json_build_object('kind', 'single_order', 'mealPrice', meal_price, 'platformFee', platform_fee, 'deliveryFee', delivery_fee, 'total', debit_amount)::text);
  return result;
end;
$$;

revoke all on function public.create_single_order_with_wallet(uuid, jsonb) from public;
grant execute on function public.create_single_order_with_wallet(uuid, jsonb) to authenticated;

alter table public.subscriptions
  add column if not exists amount_paid integer not null default 0 check (amount_paid >= 0),
  add column if not exists total_days integer not null default 1 check (total_days > 0),
  add column if not exists price_per_meal integer not null default 0 check (price_per_meal >= 0);

-- TODO(Razorpay): these RPCs currently simulate successful payment; gate them with verified payment webhooks at launch.

alter table public.orders
  alter column subscription_id drop not null,
  add column if not exists order_type text not null default 'subscription' check (order_type in ('subscription', 'single')),
  add column if not exists meal_price integer not null default 0 check (meal_price >= 0),
  add column if not exists delivery_mode public.delivery_mode not null default 'self-pickup';

create unique index if not exists orders_single_slot_idx on public.orders (customer_id, cook_id, delivery_date, meal_type) where order_type = 'single';

create or replace function public.create_subscription_with_capacity(customer uuid, payload jsonb)
returns public.subscriptions
language plpgsql security definer set search_path = public
as $$
declare cook_row public.cook_profiles; result public.subscriptions; active_count integer; plan_days integer; meal_price integer; plan_amount integer; delivery_amount integer; platform_amount integer;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  plan_days := case when payload->>'plan_type' = 'weekly' then 7 when payload->>'plan_type' = 'monthly' then 30 else 0 end;
  if plan_days = 0 then raise exception 'Invalid plan'; end if;
  select count(*) into active_count from public.subscriptions where cook_id = cook_row.id and status = 'active';
  if active_count + 1 > cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  meal_price := coalesce((payload->>'price_per_meal')::integer, cook_row.price_per_meal);
  plan_amount := coalesce((payload->>'plan_amount')::integer, case when plan_days = 7 then cook_row.weekly_price else cook_row.monthly_price end);
  delivery_amount := coalesce((payload->>'delivery_fee')::integer, 0) * plan_days;
  platform_amount := coalesce((payload->>'platform_fee_per_meal')::integer, 15) * plan_days;
  insert into public.subscriptions (customer_id, cook_id, plan_type, meal_type, start_date, end_date, delivery_mode, amount_paid, total_days, price_per_meal)
  values (customer, cook_row.id, payload->>'plan_type', payload->>'meal_type', (payload->>'start_date')::date, (payload->>'end_date')::date, (payload->>'delivery_mode')::public.delivery_mode, plan_amount + delivery_amount + platform_amount, plan_days, meal_price)
  returning * into result;
  return result;
end;
$$;

create or replace function public.create_single_order(customer uuid, payload jsonb)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare cook_row public.cook_profiles; result public.orders; order_date date; current_count integer; meal_price integer;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  select count(*) into current_count from public.orders where cook_id = cook_row.id and delivery_date = current_date and status in ('pending', 'confirmed');
  if current_count >= cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  order_date := greatest(current_date, coalesce((payload->>'delivery_date')::date, current_date));
  meal_price := coalesce((payload->>'meal_price')::integer, cook_row.price_per_meal);
  insert into public.orders (subscription_id, order_type, cook_id, customer_id, delivery_date, meal_type, status, delivery_zone_id, handover_code_hash, meal_price, delivery_mode)
  values (null, 'single', cook_row.id, customer, order_date, payload->>'meal_type', 'pending', null, crypt(payload->>'handover_code', gen_salt('bf')), meal_price, (payload->>'delivery_mode')::public.delivery_mode)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.create_subscription_with_capacity(uuid, jsonb) from public;
revoke all on function public.create_single_order(uuid, jsonb) from public;
grant execute on function public.create_subscription_with_capacity(uuid, jsonb) to authenticated;
grant execute on function public.create_single_order(uuid, jsonb) to authenticated;

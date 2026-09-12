-- Payment-backed checkout and handover flows. Wallets are not referenced.

create or replace function public.create_single_order_for_payment(customer uuid, payload jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare cook_row public.cook_profiles; result public.orders; order_date date; payment_row public.payments; current_count integer; transfer_hold_until timestamptz;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into payment_row from public.payments where id = (payload->>'payment_id')::uuid and customer_id = customer for update;
  if payment_row.id is null then raise exception 'Payment not found'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;
  order_date := greatest(current_date, coalesce((payload->>'delivery_date')::date, current_date));
  select count(*) into current_count from public.orders where cook_id = cook_row.id and delivery_date = order_date and status in ('pending', 'confirmed');
  if current_count >= cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  transfer_hold_until := (order_date + 1)::timestamptz;
  insert into public.orders (subscription_id, order_type, cook_id, customer_id, delivery_date, meal_type, status, delivery_zone_id, handover_code, handover_code_hash, meal_price, delivery_mode, payment_id)
  values (null, 'single', cook_row.id, customer, order_date, payload->>'meal_type', 'pending', nullif(payload->>'delivery_zone_id', '')::uuid, payload->>'handover_code', crypt(payload->>'handover_code', gen_salt('bf')), (payload->>'meal_price')::integer, (payload->>'delivery_mode')::public.delivery_mode, payment_row.id)
  returning * into result;
  insert into public.transfers (payment_id, cook_id, order_id, amount, hold_until)
  values (payment_row.id, cook_row.id, result.id, (payload->>'meal_price')::integer, transfer_hold_until);
  return result;
end; $$;

create or replace function public.create_subscription_for_payment(customer uuid, payload jsonb)
returns public.subscriptions language plpgsql security definer set search_path = public as $$
declare cook_row public.cook_profiles; payment_row public.payments; result public.subscriptions; active_count integer; days integer; day_index integer; meal_price integer; start_day date; day_order public.orders; handover_code text; transfer_hold_until timestamptz; delivery_mode_value public.delivery_mode; plan_value text; meal_value text;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  if payload is null then raise exception 'Subscription payload is required'; end if;
  if payload->>'payment_id' is null or payload->>'cook_id' is null then raise exception 'Checkout payload is missing payment or cook details'; end if;

  select * into payment_row from public.payments where id = (payload->>'payment_id')::uuid and customer_id = customer for update;
  if payment_row.id is null then raise exception 'Payment not found'; end if;
  select * into cook_row from public.cook_profiles where id = (payload->>'cook_id')::uuid for update;
  if cook_row.id is null or cook_row.status <> 'active' then raise exception 'Cook is unavailable'; end if;

  plan_value := payload->>'plan_type';
  meal_value := payload->>'meal_type';
  delivery_mode_value := (payload->>'delivery_mode')::public.delivery_mode;
  days := case when plan_value = 'weekly' then 7 when plan_value = 'monthly' then 30 else 0 end;
  if days = 0 then raise exception 'Invalid plan'; end if;
  if meal_value is null or meal_value = '' then raise exception 'Meal type is required'; end if;

  select count(*) into active_count from public.subscriptions where cook_id = cook_row.id and status = 'active';
  if active_count + 1 > cook_row.daily_capacity then raise exception 'Cook capacity reached'; end if;
  meal_price := coalesce((payload->>'meal_price')::integer, cook_row.price_per_meal);
  start_day := greatest(current_date, (payload->>'start_date')::date);
  insert into public.subscriptions (customer_id, cook_id, plan_type, meal_type, start_date, end_date, delivery_mode, amount_paid, total_days, price_per_meal)
  values (customer, cook_row.id, plan_value, meal_value, start_day, start_day + days - 1, delivery_mode_value, payment_row.amount, days, meal_price)
  returning * into result;
  for day_index in 0..days - 1 loop
    handover_code := lpad((floor(random() * 10000))::integer::text, 4, '0');
    transfer_hold_until := (start_day + day_index + 1)::timestamptz;
    insert into public.orders (subscription_id, order_type, cook_id, customer_id, delivery_date, meal_type, status, delivery_zone_id, handover_code, handover_code_hash, meal_price, delivery_mode, payment_id)
    values (result.id, 'subscription', cook_row.id, customer, start_day + day_index, meal_value, 'pending', nullif(payload->>'delivery_zone_id', '')::uuid, handover_code, crypt(handover_code, gen_salt('bf')), meal_price, delivery_mode_value, payment_row.id)
    returning * into day_order;
    insert into public.transfers (payment_id, cook_id, order_id, amount, hold_until)
    values (payment_row.id, cook_row.id, day_order.id, meal_price, transfer_hold_until);
  end loop;
  return result;
end; $$;

create or replace function public.confirm_handover(order_id uuid, submitted_code text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare target public.orders; result public.orders; transfer_id uuid;
begin
  select * into target from public.orders where id = order_id for update;
  if target.id is null then raise exception 'Order not found'; end if;
  if not exists (select 1 from public.cook_profiles where id = target.cook_id and user_id = auth.uid()) then raise exception 'Only the assigned cook can confirm this order'; end if;
  if target.status <> 'pending' then raise exception 'Order is not pending'; end if;
  if target.handover_code_hash <> crypt(submitted_code, target.handover_code_hash) then raise exception 'Invalid handover code'; end if;
  update public.orders set status = 'delivered', handover_confirmed_at = now() where id = target.id returning * into result;
  for transfer_id in select id from public.transfers where order_id = target.id and status = 'on_hold' loop
    perform public.mock_release_transfer(transfer_id);
  end loop;
  return result;
end; $$;

revoke all on function public.create_single_order_for_payment(uuid, jsonb) from public;
revoke all on function public.create_subscription_for_payment(uuid, jsonb) from public;
revoke all on function public.confirm_handover(uuid, text) from public;
grant execute on function public.create_single_order_for_payment(uuid, jsonb) to authenticated;
grant execute on function public.create_subscription_for_payment(uuid, jsonb) to authenticated;
grant execute on function public.confirm_handover(uuid, text) to authenticated;

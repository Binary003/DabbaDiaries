alter table public.orders
  add column if not exists created_at timestamptz not null default now();

create or replace function public.get_admin_operations_summary(page_number integer default 1, page_size integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 25), 1), 100);
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_orders', (select count(*) from public.orders),
      'pending_orders', (select count(*) from public.orders where status = 'pending'),
      'confirmed_orders', (select count(*) from public.orders where status = 'confirmed'),
      'delivered_orders', (select count(*) from public.orders where status = 'delivered'),
      'cancelled_orders', (select count(*) from public.orders where status = 'cancelled'),
      'platform_revenue', coalesce((
        select sum(nullif((p.description::jsonb ->> 'platformFee'), '')::numeric)
        from public.payments p
        where p.status not in ('failed', 'refunded')
          and p.description is not null
          and p.description like '{%'
      ), 0),
      'cook_payouts', coalesce((select sum(t.amount) from public.transfers t where t.status in ('on_hold', 'released')), 0)
    ),
    'cooks', coalesce((
      select jsonb_agg(to_jsonb(cook_summary) order by cook_summary.order_count desc, cook_summary.cook_name)
      from (
        select
          cp.id as cook_id,
          cp.display_name as cook_name,
          count(o.id)::integer as order_count,
          count(o.id) filter (where o.status = 'delivered')::integer as delivered_count,
          count(o.id) filter (where o.status in ('pending', 'confirmed'))::integer as open_count,
          coalesce(sum(o.meal_price), 0)::integer as meal_value
        from public.cook_profiles cp
        left join public.orders o on o.cook_id = cp.id
        group by cp.id, cp.display_name
      ) cook_summary
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(to_jsonb(recent_order) order by recent_order.delivery_date desc, recent_order.created_at desc)
      from (
        select
          o.id,
          o.subscription_id,
          o.order_type,
          o.customer_id,
          o.cook_id,
          o.delivery_date,
          o.meal_type,
          o.status,
          o.delivery_zone_id,
          o.delivery_mode,
          o.created_at,
          coalesce(p.full_name, p.name, '') as customer_name,
          p.phone as customer_phone,
          p.pincode,
          p.locality as customer_locality,
          cp.display_name as cook_name
        from public.orders o
        join public.profiles p on p.id = o.customer_id
        join public.cook_profiles cp on cp.id = o.cook_id
        order by o.delivery_date desc, o.created_at desc
        limit safe_size offset (safe_page - 1) * safe_size
      ) recent_order
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_operations_summary(integer, integer) from public;
grant execute on function public.get_admin_operations_summary(integer, integer) to authenticated;

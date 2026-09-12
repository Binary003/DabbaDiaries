-- Delivery participants may read only the customer profile fields needed to complete a delivery.
-- Keep this migration safe when the earlier order-ledger migration was not applied yet.
alter table public.orders
  add column if not exists delivery_mode public.delivery_mode not null default 'self-pickup';

alter table public.orders
  add column if not exists delivery_zone_id uuid references public.delivery_zones(id);

drop policy if exists "delivery participants read customer contact" on public.profiles;
create policy "delivery participants read customer contact" on public.profiles for select
  using (
    exists (
      select 1
      from public.orders
      where orders.customer_id = profiles.id
        and (
          orders.delivery_mode in ('cook-delivery', 'platform-delivery')
          and (
            orders.cook_id in (select id from public.cook_profiles where user_id = auth.uid())
            or public.is_admin()
          )
        )
    )
  );
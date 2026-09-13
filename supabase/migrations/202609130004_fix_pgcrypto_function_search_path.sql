-- Supabase commonly installs pgcrypto functions in the extensions schema.
-- Keep security-definer RPCs able to resolve crypt() and gen_salt().

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('public.confirm_handover(uuid,text)') is not null then
    alter function public.confirm_handover(uuid, text) set search_path = public, extensions;
  end if;
  if to_regprocedure('public.create_single_order(uuid,jsonb)') is not null then
    alter function public.create_single_order(uuid, jsonb) set search_path = public, extensions;
  end if;
  if to_regprocedure('public.create_single_order_with_wallet(uuid,jsonb)') is not null then
    alter function public.create_single_order_with_wallet(uuid, jsonb) set search_path = public, extensions;
  end if;
  if to_regprocedure('public.create_single_order_for_payment(uuid,jsonb)') is not null then
    alter function public.create_single_order_for_payment(uuid, jsonb) set search_path = public, extensions;
  end if;
  if to_regprocedure('public.create_subscription_for_payment(uuid,jsonb)') is not null then
    alter function public.create_subscription_for_payment(uuid, jsonb) set search_path = public, extensions;
  end if;
end $$;

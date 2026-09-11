alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = coalesce(nullif(full_name, ''), name)
where full_name is null or full_name = '';

create or replace function public.ensure_wallet(customer uuid)
returns public.wallets
language plpgsql
security definer
set search_path = public
as $$
declare result public.wallets;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  select * into result from public.wallets where user_id = customer for update;
  if result.id is null then
    insert into public.wallets (user_id, balance) values (customer, 0) returning * into result;
  end if;
  return result;
end;
$$;

revoke all on function public.ensure_wallet(uuid) from public;
grant execute on function public.ensure_wallet(uuid) to authenticated;

create or replace function public.debit_wallet(customer uuid, debit_amount numeric, debit_type public.wallet_transaction_type, debit_description text)
returns public.wallets
language plpgsql security definer
set search_path = public
as $$
declare wallet_row public.wallets; result public.wallets;
begin
  if customer <> auth.uid() then raise exception 'Customer identity mismatch'; end if;
  if debit_amount <= 0 or debit_type not in ('subscription_debit', 'single_order_debit') then raise exception 'Invalid wallet debit'; end if;
  select * into wallet_row from public.wallets where user_id = customer for update;
  if wallet_row.id is null then raise exception 'Wallet not found'; end if;
  if wallet_row.balance < debit_amount then raise exception 'INSUFFICIENT_WALLET_BALANCE:%', debit_amount - wallet_row.balance; end if;
  update public.wallets set balance = balance - debit_amount, updated_at = now() where id = wallet_row.id returning * into result;
  insert into public.wallet_transactions (wallet_id, type, amount, description) values (wallet_row.id, debit_type, debit_amount, debit_description);
  return result;
end;
$$;

revoke all on function public.debit_wallet(uuid, numeric, public.wallet_transaction_type, text) from public;
grant execute on function public.debit_wallet(uuid, numeric, public.wallet_transaction_type, text) to authenticated;

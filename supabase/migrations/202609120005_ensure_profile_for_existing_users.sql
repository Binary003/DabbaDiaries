create or replace function public.ensure_profile_for_current_user()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_row auth.users;
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into current_user_row from auth.users where id = auth.uid();
  if current_user_row.id is null then
    raise exception 'Authenticated user not found';
  end if;

  insert into public.profiles (id, name, full_name, phone, role, pincode, locality)
  values (
    current_user_row.id,
    coalesce(current_user_row.raw_user_meta_data->>'name', split_part(coalesce(current_user_row.email, 'New user'), '@', 1)),
    coalesce(current_user_row.raw_user_meta_data->>'full_name', current_user_row.raw_user_meta_data->>'name', split_part(coalesce(current_user_row.email, 'New user'), '@', 1)),
    coalesce(current_user_row.raw_user_meta_data->>'phone', ''),
    case when current_user_row.raw_user_meta_data->>'role' = 'cook' then 'cook'::public.user_role else 'customer'::public.user_role end,
    coalesce(current_user_row.raw_user_meta_data->>'pincode', ''),
    coalesce(current_user_row.raw_user_meta_data->>'locality', '')
  )
  on conflict (id) do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.profiles where id = auth.uid();
  end if;
  return result;
end;
$$;

revoke all on function public.ensure_profile_for_current_user() from public;
grant execute on function public.ensure_profile_for_current_user() to authenticated;
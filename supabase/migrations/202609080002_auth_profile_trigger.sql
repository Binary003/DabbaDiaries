create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, role, pincode, locality)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'New user'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    case when new.raw_user_meta_data->>'role' = 'cook' then 'cook'::public.user_role else 'customer'::public.user_role end,
    coalesce(new.raw_user_meta_data->>'pincode', ''),
    coalesce(new.raw_user_meta_data->>'locality', '')
  );
  return new;
end;
$$;

 drop trigger if exists on_auth_user_created on auth.users;
 create trigger on_auth_user_created
   after insert on auth.users
   for each row execute procedure public.handle_new_user();

revoke all on function public.handle_new_user() from public;

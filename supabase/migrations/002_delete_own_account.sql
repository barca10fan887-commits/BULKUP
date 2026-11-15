-- Lets a signed-in user permanently delete their own account from inside the app
-- (required by the App Store). All their rows are removed by ON DELETE CASCADE.
-- Their progress photos are removed by the app just before this is called.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

begin;
create table public.beer_counts (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 count integer not null default 0 check(count >= 0),
 updated_at timestamptz not null default now()
);
alter table public.beer_counts enable row level security;
revoke all on public.beer_counts from anon,authenticated;
grant select,insert,update on public.beer_counts to authenticated;
create policy beer_own on public.beer_counts for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.adjust_beer(delta integer) returns integer
language plpgsql security invoker set search_path='' as $$
declare result integer;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 if delta is null or delta not in (-1,1) then raise exception 'Ungültige Änderung'; end if;
 insert into public.beer_counts(user_id,count) values(auth.uid(),greatest(0,delta))
 on conflict(user_id) do update set count=greatest(0,public.beer_counts.count+delta),updated_at=now()
 returning count into result;
 return result;
end; $$;
create function public.beer_leaderboard() returns table(user_id uuid,display_name text,beers integer)
language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,coalesce(b.count,0) from public.profiles p
 left join public.beer_counts b on b.user_id=p.id
 where (select auth.uid()) is not null order by coalesce(b.count,0) desc,p.id;
$$;
revoke all on function public.adjust_beer(integer),public.beer_leaderboard() from public,anon;
grant execute on function public.adjust_beer(integer),public.beer_leaderboard() to authenticated;
notify pgrst,'reload schema';
commit;

begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  created_at timestamptz not null default now()
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Ski-Fan'),32));
 return new;
end; $$;
create trigger on_signup after insert on auth.users for each row execute function public.create_profile();
create table public.tours (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(),
 km double precision not null check (km >= 0 and km < 100000),
 max_speed double precision check (max_speed >= 0 and max_speed <= 216),
 ascent integer not null default 0 check(ascent >= 0),
 seconds integer not null check(seconds >= 0 and seconds <= 604800)
);
create table public.apres_visits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 proof_path text not null unique,
 created_at timestamptz not null default now(),
 check(proof_path = user_id::text || '/' || id::text || '.jpg')
);
create table public.posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 image_path text not null unique,
 caption text not null default '' check(char_length(caption) <= 180),
 created_at timestamptz not null default now(),
 check(image_path = user_id::text || '/' || id::text || '.jpg')
);
create index tours_user on public.tours(user_id);
create index apres_user on public.apres_visits(user_id);
create index posts_created on public.posts(created_at desc);
alter table public.profiles enable row level security;
alter table public.tours enable row level security;
alter table public.apres_visits enable row level security;
alter table public.posts enable row level security;
revoke all on public.profiles, public.tours, public.apres_visits, public.posts from anon, authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.tours to authenticated;
grant select,insert,delete on public.apres_visits,public.posts to authenticated;
create policy profiles_members on public.profiles for select to authenticated using (true);
create policy tours_own on public.tours for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy apres_own_read on public.apres_visits for select to authenticated using(user_id=(select auth.uid()));
create policy apres_own_delete on public.apres_visits for delete to authenticated using(user_id=(select auth.uid()));
create policy apres_own_insert on public.apres_visits for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from storage.objects where bucket_id='apres-proofs' and name=proof_path)
);
create policy posts_members on public.posts for select to authenticated using(true);
create policy posts_own_delete on public.posts for delete to authenticated using(user_id=(select auth.uid()));
create policy posts_own_insert on public.posts for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from storage.objects where bucket_id='community-photos' and name=image_path)
);
-- Raw tour and proof rows remain private; only aggregates are shared with members.
create function public.leaderboard() returns table(user_id uuid,display_name text,km double precision,max_speed double precision,apres_visits bigint)
language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,coalesce(t.km,0),t.max_speed,coalesce(a.visits,0)
 from public.profiles p
 left join (select user_id,sum(km) km,max(max_speed) max_speed from public.tours group by user_id) t on t.user_id=p.id
 left join (select user_id,count(*) visits from public.apres_visits group by user_id) a on a.user_id=p.id
 where (select auth.uid()) is not null order by coalesce(t.km,0) desc,p.id;
$$;
revoke all on function public.leaderboard() from public,anon;
grant execute on function public.leaderboard() to authenticated;
revoke all on function public.create_profile() from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('apres-proofs','apres-proofs',false,8388608,array['image/jpeg']),
 ('community-photos','community-photos',false,8388608,array['image/jpeg']);
create policy skiduell_upload on storage.objects for insert to authenticated with check (
 bucket_id in ('apres-proofs','community-photos') and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy skiduell_read on storage.objects for select to authenticated using (
 (bucket_id='apres-proofs' and (storage.foldername(name))[1]=(select auth.uid())::text)
 or (bucket_id='community-photos' and exists(select 1 from public.posts where image_path=name))
 or (bucket_id='community-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
);
create policy skiduell_delete on storage.objects for delete to authenticated using (
 bucket_id in ('apres-proofs','community-photos') and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.apres_visits where proof_path=name and bucket_id='apres-proofs')
 and not exists(select 1 from public.posts where image_path=name and bucket_id='community-photos')
);
commit;

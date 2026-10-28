begin;
create table public.photo_likes (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(post_id,user_id)
);
create table public.photo_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 500 and body ~ '[^[:space:]]'),
 created_at timestamptz not null default now()
);
create index photo_comments_latest on public.photo_comments(post_id,created_at desc,id desc);
alter table public.photo_likes enable row level security;
alter table public.photo_comments enable row level security;
revoke all on public.photo_likes,public.photo_comments from public,anon,authenticated;
grant select,insert,delete on public.photo_likes to authenticated;
grant select,delete on public.photo_comments to authenticated;
grant insert(id,post_id,user_id,body) on public.photo_comments to authenticated;
create policy likes_read on public.photo_likes for select to authenticated using(true);
create policy likes_insert on public.photo_likes for insert to authenticated with check(user_id=(select auth.uid()));
create policy likes_delete on public.photo_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy comments_read on public.photo_comments for select to authenticated using(true);
create policy comments_insert on public.photo_comments for insert to authenticated with check(user_id=(select auth.uid()));
create policy comments_delete on public.photo_comments for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
create function public.photo_reaction_counts(post_ids uuid[]) returns table(post_id uuid,likes bigint,liked boolean,comments bigint)
language sql stable security invoker set search_path='' as $$
 select p.id,
 (select count(*) from public.photo_likes l where l.post_id=p.id),
 exists(select 1 from public.photo_likes l where l.post_id=p.id and l.user_id=(select auth.uid())),
 (select count(*) from public.photo_comments c where c.post_id=p.id)
 from public.posts p where p.id=any(post_ids) and (select auth.uid()) is not null limit 50;
$$;
revoke all on function public.photo_reaction_counts(uuid[]) from public,anon;
grant execute on function public.photo_reaction_counts(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;

begin;
create table public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 1000 and body ~ '[^[:space:]]'),
 created_at timestamptz not null default now(),
 check(sender_id<>recipient_id)
);
create index dm_sender_latest on public.direct_messages(sender_id,created_at desc,id desc);
create index dm_recipient_latest on public.direct_messages(recipient_id,created_at desc,id desc);
alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from public,anon,authenticated;
grant select,delete on public.direct_messages to authenticated;
grant insert(id,sender_id,recipient_id,body) on public.direct_messages to authenticated;
create policy dm_participants_read on public.direct_messages for select to authenticated using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy dm_sender_insert on public.direct_messages for insert to authenticated with check(sender_id=(select auth.uid()));
create policy dm_sender_delete on public.direct_messages for delete to authenticated using(sender_id=(select auth.uid()));
create function public.dm_conversations() returns table(user_id uuid,display_name text,last_body text,last_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select latest.peer,p.display_name,latest.body,latest.created_at from (
  select distinct on(peer) peer,body,created_at,id from (
   select case when sender_id=(select auth.uid()) then recipient_id else sender_id end peer,body,created_at,id
   from public.direct_messages
   where sender_id=(select auth.uid()) or recipient_id=(select auth.uid())
  ) visible order by peer,created_at desc,id desc
 ) latest join public.profiles p on p.id=latest.peer order by latest.created_at desc,latest.id desc limit 100;
$$;
revoke all on function public.dm_conversations() from public,anon;
grant execute on function public.dm_conversations() to authenticated;
notify pgrst,'reload schema';
commit;

begin;
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 1000 and body ~ '[^[:space:]]'),
 created_at timestamptz not null default now()
);
create index chat_messages_latest on public.chat_messages(created_at desc,id desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from public,anon,authenticated;
grant select,delete on public.chat_messages to authenticated;
grant insert(id,user_id,body) on public.chat_messages to authenticated;
create policy chat_members_read on public.chat_messages for select to authenticated using(true);
create policy chat_own_insert on public.chat_messages for insert to authenticated with check(user_id=(select auth.uid()));
create policy chat_delete on public.chat_messages for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_admin()));
notify pgrst,'reload schema';
commit;

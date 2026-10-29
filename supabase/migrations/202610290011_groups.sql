begin;
create table public.chat_groups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(name) between 2 and 60 and name ~ '[^[:space:]]'),
 created_at timestamptz not null default now()
);
create table public.group_members (
 group_id uuid not null references public.chat_groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(group_id,user_id)
);
create table public.group_messages (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.chat_groups(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 1000 and body ~ '[^[:space:]]'),
 created_at timestamptz not null default now()
);
create index group_messages_latest on public.group_messages(group_id,created_at desc,id desc);
create index group_members_user on public.group_members(user_id);
alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
revoke all on public.chat_groups,public.group_members,public.group_messages from public,anon,authenticated;
grant select,delete on public.chat_groups to authenticated;
grant select on public.group_members to authenticated;
grant select,delete on public.group_messages to authenticated;
grant insert(id,group_id,user_id,body) on public.group_messages to authenticated;
create function public.is_group_member(target_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_members where group_id=target_group and user_id=(select auth.uid()));
$$;
create function public.is_group_owner(target_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chat_groups where id=target_group and owner_id=(select auth.uid()));
$$;
create policy group_read on public.chat_groups for select to authenticated using(public.is_group_member(id));
create policy group_delete on public.chat_groups for delete to authenticated using(owner_id=(select auth.uid()));
create policy group_members_read on public.group_members for select to authenticated using(public.is_group_member(group_id));
create policy group_messages_read on public.group_messages for select to authenticated using(public.is_group_member(group_id));
create policy group_messages_insert on public.group_messages for insert to authenticated with check(user_id=(select auth.uid()) and public.is_group_member(group_id));
create policy group_messages_delete on public.group_messages for delete to authenticated using(public.is_group_member(group_id) and (user_id=(select auth.uid()) or public.is_group_owner(group_id)));
create function public.create_group(group_name text,member_ids uuid[],new_group uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
 if auth.uid() is null then raise exception 'Anmeldung erforderlich'; end if;
 if new_group is null or char_length(btrim(group_name)) not between 2 and 60 or group_name is null then raise exception 'Gruppenname muss 2–60 Zeichen haben'; end if;
 if coalesce(cardinality(member_ids),0)>49 then raise exception 'Maximal 50 Mitglieder'; end if;
 select owner_id into existing from public.chat_groups where id=new_group;
 if existing is not null then
  if existing<>auth.uid() then raise exception 'Gruppe nicht verfügbar'; end if;
  return new_group;
 end if;
 insert into public.chat_groups(id,owner_id,name) values(new_group,auth.uid(),btrim(group_name));
 insert into public.group_members(group_id,user_id) select new_group,u from (select auth.uid() u union select unnest(coalesce(member_ids,array[]::uuid[]))) users where u is not null;
 return new_group;
end; $$;
create function public.set_group_member(target_group uuid,target_user uuid,add_member boolean) returns void language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 select owner_id into owner from public.chat_groups where id=target_group for update;
 if owner is null or owner<>auth.uid() or auth.uid() is null then raise exception 'Nur für Gruppenersteller'; end if;
 if target_user=owner or target_user is null or add_member is null then raise exception 'Ungültige Mitgliedsänderung'; end if;
 if add_member then
  if (select count(*) from public.group_members where group_id=target_group)>=50 and not exists(select 1 from public.group_members where group_id=target_group and user_id=target_user) then raise exception 'Maximal 50 Mitglieder'; end if;
  insert into public.group_members(group_id,user_id) values(target_group,target_user) on conflict do nothing;
 else delete from public.group_members where group_id=target_group and user_id=target_user;
 end if;
end; $$;
create function public.leave_group(target_group uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_group_owner(target_group) then raise exception 'Gruppenersteller können ihre Gruppe nur löschen'; end if;
 delete from public.group_members where group_id=target_group and user_id=auth.uid();
end; $$;
revoke all on function public.is_group_member(uuid),public.is_group_owner(uuid),public.create_group(text,uuid[],uuid),public.set_group_member(uuid,uuid,boolean),public.leave_group(uuid) from public,anon;
grant execute on function public.is_group_member(uuid),public.is_group_owner(uuid),public.create_group(text,uuid[],uuid),public.set_group_member(uuid,uuid,boolean),public.leave_group(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

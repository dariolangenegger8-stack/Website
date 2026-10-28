begin;
alter table public.profiles
 add column bio text not null default '' check(char_length(bio)<=500),
 add column avatar_path text,
 add column banner_path text,
 add constraint avatar_owner check(avatar_path is null or split_part(avatar_path,'/',1)=id::text),
 add constraint banner_owner check(banner_path is null or split_part(banner_path,'/',1)=id::text);
grant update(display_name,bio,avatar_path,banner_path) on public.profiles to authenticated;
create policy profiles_own_update on public.profiles for update to authenticated
 using(id=(select auth.uid())) with check(id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-media','profile-media',false,8388608,array['image/jpeg']);
create policy profile_media_upload on storage.objects for insert to authenticated with check(
 bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy profile_media_read on storage.objects for select to authenticated using(
 bucket_id='profile-media' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.profiles where avatar_path=name or banner_path=name))
);
create policy profile_media_delete on storage.objects for delete to authenticated using(
 bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.profiles where avatar_path=name or banner_path=name)
);
notify pgrst,'reload schema';
commit;

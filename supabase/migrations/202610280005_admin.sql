begin;
create table public.app_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public,anon,authenticated;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.app_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
create policy admin_tours_read on public.tours for select to authenticated using((select public.is_admin()));
create policy admin_tours_delete on public.tours for delete to authenticated using((select public.is_admin()));
create policy admin_apres_read on public.apres_visits for select to authenticated using((select public.is_admin()));
create policy admin_apres_delete on public.apres_visits for delete to authenticated using((select public.is_admin()));
create policy admin_posts_delete on public.posts for delete to authenticated using((select public.is_admin()));
create policy admin_entry_images_read on storage.objects for select to authenticated using(
 bucket_id in ('apres-proofs','community-photos') and (select public.is_admin())
);
create policy admin_entry_images_delete on storage.objects for delete to authenticated using(
 bucket_id in ('apres-proofs','community-photos') and (select public.is_admin())
 and not exists(select 1 from public.apres_visits where proof_path=name and bucket_id='apres-proofs')
 and not exists(select 1 from public.posts where image_path=name and bucket_id='community-photos')
);
notify pgrst,'reload schema';
commit;

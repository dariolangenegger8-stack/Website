begin;
grant delete on public.beer_counts,public.mix_counts to authenticated;
create policy admin_beer_read on public.beer_counts for select to authenticated using((select public.is_admin()));
create policy admin_beer_delete on public.beer_counts for delete to authenticated using((select public.is_admin()));
create policy admin_mix_read on public.mix_counts for select to authenticated using((select public.is_admin()));
create policy admin_mix_delete on public.mix_counts for delete to authenticated using((select public.is_admin()));
notify pgrst,'reload schema';
commit;

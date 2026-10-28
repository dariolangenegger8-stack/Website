begin;
create function public.admin_reduce_counter(counter_kind text,target_user uuid,amount integer) returns integer
language plpgsql security definer set search_path='' as $$
declare result integer;
begin
 if not public.is_admin() then raise exception 'Nur für Administratoren'; end if;
 if amount is null or amount<1 then raise exception 'Die Menge muss eine positive ganze Zahl sein'; end if;
 if counter_kind='beer' then
  update public.beer_counts set count=greatest(0,count-amount),updated_at=now() where user_id=target_user returning count into result;
 elsif counter_kind='mix' then
  update public.mix_counts set count=greatest(0,count-amount),updated_at=now() where user_id=target_user returning count into result;
 else
  raise exception 'Unbekannter Zähler';
 end if;
 if result is null then raise exception 'Zähler nicht gefunden. Bitte aktualisieren.'; end if;
 return result;
end; $$;
revoke all on function public.admin_reduce_counter(text,uuid,integer) from public,anon;
grant execute on function public.admin_reduce_counter(text,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;

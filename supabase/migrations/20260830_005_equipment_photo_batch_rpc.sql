create or replace function public.rpc_equipment_photo_paths(p_equipment_ids text[] default null)
returns table(equipment_id text, path text)
language sql
security definer
set search_path = public, storage
as $$
  select e.equipment_id, o.name as path
  from public.equipment_master e
  join storage.objects o
    on o.bucket_id = 'equipment-photos'
   and o.name = e.equipment_id || '/photo.webp'
  where auth.uid() is not null
    and (p_equipment_ids is null or e.equipment_id = any(p_equipment_ids))
  order by e.equipment_id;
$$;

revoke all on function public.rpc_equipment_photo_paths(text[]) from public;
grant execute on function public.rpc_equipment_photo_paths(text[]) to authenticated;

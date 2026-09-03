-- Harden Spare Parts V1 for Supabase Data API.
-- Postgres 15+ security_invoker makes the view obey underlying RLS.
alter view public.spare_part_overview set (security_invoker = true);

revoke all on public.spare_part_master from anon;
revoke all on public.equipment_spare_part from anon;
revoke all on public.spare_part_usage from anon;
revoke all on public.spare_part_overview from anon;

grant select on public.spare_part_master to authenticated;
grant select on public.equipment_spare_part to authenticated;
grant select on public.spare_part_usage to authenticated;
grant select on public.spare_part_overview to authenticated;

-- SECURITY DEFINER functions must not remain executable by PUBLIC/anon.
revoke all on function public.rpc_save_spare_part(jsonb) from public;
revoke all on function public.rpc_record_spare_usage(jsonb) from public;
revoke all on function public.rpc_save_spare_part(jsonb) from anon;
revoke all on function public.rpc_record_spare_usage(jsonb) from anon;
grant execute on function public.rpc_save_spare_part(jsonb) to authenticated;
grant execute on function public.rpc_record_spare_usage(jsonb) to authenticated;

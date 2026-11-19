create or replace function public.mumove_assign_stop_operators()
returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare changed integer;
begin
 update public.transport_stops s
 set operator_id=x.operator_id, updated_at=now()
 from (
   select distinct on (rs.stop_id) rs.stop_id,r.operator_id
   from public.transport_route_stops rs
   join public.transport_routes r on r.id=rs.route_id
   order by rs.stop_id,r.operator_id
 ) x
 where s.id=x.stop_id and s.operator_id is distinct from x.operator_id;
 get diagnostics changed = row_count;
 return changed;
end;
$$;
revoke execute on function public.mumove_assign_stop_operators() from public,anon,authenticated;
grant execute on function public.mumove_assign_stop_operators() to service_role;

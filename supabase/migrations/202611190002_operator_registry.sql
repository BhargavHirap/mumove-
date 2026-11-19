-- MUMOVE operator registry, source provenance and query indexes.
-- Metadata only: no unverified timetable, fare or live-position rows are inserted.
create index if not exists transport_data_sources_operator_idx on public.transport_data_sources(operator_id);
create index if not exists transport_routes_origin_idx on public.transport_routes(origin_stop_id);
create index if not exists transport_routes_destination_idx on public.transport_routes(destination_stop_id);
create index if not exists transport_service_alerts_operator_idx on public.transport_service_alerts(operator_id);
create index if not exists transport_service_alerts_route_idx on public.transport_service_alerts(route_id);
create index if not exists transport_service_alerts_stop_idx on public.transport_service_alerts(stop_id);
create index if not exists transport_vehicle_positions_operator_idx on public.transport_vehicle_positions(operator_id);

-- Restrict an existing SECURITY DEFINER helper from direct API invocation.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

insert into public.transport_operators (id,name,mode,region,official_url,data_status)
values
 ('central-railway','Central Railway · Mumbai Suburban','suburban_rail','Mumbai','https://cr.indianrailways.gov.in/','reference_only'),
 ('western-railway','Western Railway · Mumbai Suburban','suburban_rail','Mumbai','https://wr.indianrailways.gov.in/','reference_only'),
 ('best','BEST Undertaking','bus','Mumbai','https://www.bestundertaking.com/','reference_only'),
 ('mumbai-metro-one','Mumbai Metro One · Line 1','metro','Mumbai','https://www.mumbaimetroone.com/','reference_only'),
 ('mmrda-metro','MMRDA Metro Corridors','metro','Mumbai Metropolitan Region','https://www.mmrda.maharashtra.gov.in/','reference_only'),
 ('mmrcl-metro-3','Mumbai Metro Rail Corporation · Line 3','metro','Mumbai','https://mmrcl.com/','reference_only')
on conflict (id) do update set name=excluded.name,mode=excluded.mode,official_url=excluded.official_url,updated_at=now();

insert into public.transport_data_sources (id,operator_id,name,source_type,source_url,access_status,notes)
values
 ('central-railway-timetable','central-railway','Central Railway published suburban timetable','official_web','https://cr.indianrailways.gov.in/offerings/schemes-and-services/preview/1122','public','Official timetable reference page. No automated real-time feed connection is configured.'),
 ('western-railway-timetable','western-railway','Western Railway published Mumbai suburban timetable','official_web','https://wr.indianrailways.gov.in/offerings/custom/Mumbai%20Suburban/preview/523','public','Official timetable reference page. Timetable validity must be checked against the latest notice.'),
 ('best-official','best','BEST Undertaking official website and Prawas app','official_web','https://www.bestundertaking.com/','public','Official operator reference. No authorised API credentials or live ETA feed configured.'),
 ('best-community-gtfs','best','Community-maintained Mumbai GTFS schedule','gtfs','https://github.com/croyla/mumbai-gtfs','public','MIT-0 community repository with BEST/TMT/KDMT schedules. Not an official BEST feed; validate service dates and stop coverage before publishing.'),
 ('metro-mmrda','mmrda-metro','MMRDA metro timetable and service notices','official_web','https://www.mmrda.maharashtra.gov.in/','public','Official authority source. Timetable files are published as notices; no automated API feed configured.'),
 ('metro-line-1','mumbai-metro-one','Mumbai Metro One official service information','official_web','https://www.mumbaimetroone.com/','public','Official operator reference; no live feed connected.'),
 ('metro-line-3','mmrcl-metro-3','MMRCL Aqua Line service information','official_web','https://mmrcl.com/','public','Official operator reference; no live feed connected.'),
 ('osm-stops',null, 'OpenStreetMap public transport map data','open_data','https://www.openstreetmap.org/','public','Community-mapped stop/station locations. Not an operator timetable or live vehicle feed.')
on conflict (id) do update set name=excluded.name,source_url=excluded.source_url,access_status=excluded.access_status,notes=excluded.notes,updated_at=now();

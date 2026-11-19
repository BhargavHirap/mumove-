create index if not exists transport_fare_products_operator_idx on public.transport_fare_products(operator_id);
create index if not exists transport_fare_rules_fare_idx on public.transport_fare_rules(fare_id);
create index if not exists transport_fare_rules_route_idx on public.transport_fare_rules(route_id);

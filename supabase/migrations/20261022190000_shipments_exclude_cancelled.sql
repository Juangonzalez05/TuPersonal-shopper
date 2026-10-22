-- =====================================================================
-- v_shipments sin pedidos anulados (TODO de la migración inicial).
-- Igual que la hoja "Control de envíos" del Excel, por caja completa:
--   productos en la caja = número de líneas      (COUNTIF)
--   envío cobrado        = suma del envío cobrado (SUMIFS)
--   diferencia           = envío cobrado − costo real; nula si está "por cerrar"
-- Mismas columnas y en el mismo orden, así que basta con create or replace.
-- =====================================================================

create or replace view public.v_shipments with (security_invoker = true) as
select
  s.*,
  x.items_count,
  x.charged_cop,
  case when s.real_cost_cop is null then 'por_cerrar' else 'cerrada' end as state,
  case when s.real_cost_cop is null then null
       else x.charged_cop - s.real_cost_cop end                          as difference_cop
from public.shipments s
left join lateral (
  select count(*)::int                                     as items_count,
         coalesce(sum(oi.shipping_charged_cop), 0)::bigint as charged_cop
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.shipment_id = s.id
    and o.status <> 'anulado'
) x on true;

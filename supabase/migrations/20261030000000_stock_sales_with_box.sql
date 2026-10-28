-- =====================================================================
-- Ventas del inventario cuyo producto entró en una caja: su envío real no se estima con
-- el promedio de todas las cajas sino con lo que le tocó de la suya.
--
--   costo por producto del inventario = promedio, ponderado por cantidad, del costo por
--   producto (v_shipments.cost_per_unit_cop) de las cajas en que entró ese producto
--
-- Columnas nuevas al final de v_orders (solo para ventas del inventario con envío cobrado):
--   stock_boxed_units    unidades cuyo producto entró en cajas con costo por producto
--   stock_boxed_real_cop lo que les toca de esas cajas
-- El resto (stock_shipping_units − stock_boxed_units) se sigue estimando con el promedio.
-- =====================================================================

create or replace view public.v_orders with (security_invoker = true) as
select
  o.*,
  t.items_price_cop,
  t.items_cost_cop,
  t.items_profit_cop,
  t.shipping_charged_cop,
  t.incomplete_items,
  (t.items_price_cop + t.shipping_charged_cop)                 as total_cop,
  pay.paid_cop,
  (t.items_price_cop + t.shipping_charged_cop - pay.paid_cop)  as balance_cop,
  case
    when (t.items_price_cop + t.shipping_charged_cop - pay.paid_cop) <= 0 then 'pagado'
    when pay.paid_cop > 0 then 'separado'
    else 'pendiente'
  end as payment_status,
  t.stock_shipping_cop,
  t.stock_shipping_units,
  t.stock_boxed_units,
  t.stock_boxed_real_cop
from public.orders o
left join lateral (
  select coalesce(sum(i.price_cop), 0)::bigint                                     as items_price_cop,
         coalesce(sum(i.cost_cop), 0)::bigint                                      as items_cost_cop,
         coalesce(sum(i.profit_cop), 0)::bigint                                    as items_profit_cop,
         coalesce(sum(i.shipping_charged_cop), 0)::bigint                          as shipping_charged_cop,
         count(*) filter (where i.incomplete)                                      as incomplete_items,
         coalesce(sum(i.shipping_charged_cop) filter (where i.from_stock), 0)::bigint as stock_shipping_cop,
         coalesce(sum(i.qty) filter (where i.from_stock and i.shipping_charged_cop > 0), 0)::int
                                                                                   as stock_shipping_units,
         coalesce(sum(i.qty) filter (where i.from_stock and i.shipping_charged_cop > 0
                                       and bc.cost_per_unit is not null), 0)::int  as stock_boxed_units,
         coalesce(round(sum(i.qty * bc.cost_per_unit) filter (where i.from_stock and i.shipping_charged_cop > 0
                                       and bc.cost_per_unit is not null)), 0)::bigint as stock_boxed_real_cop
  from public.v_order_items i
  left join lateral (
    select sum(m.qty * s.cost_per_unit_cop)::numeric / nullif(sum(m.qty), 0) as cost_per_unit
    from public.stock_movements m
    join public.v_shipments s on s.id = m.shipment_id
    where m.product_id = i.product_id
      and m.qty > 0
      and s.cost_per_unit_cop is not null
  ) bc on true
  where i.order_id = o.id
) t on true
left join lateral (
  select coalesce(sum(p.amount_cop), 0)::bigint as paid_cop
  from public.payments p
  where p.order_id = o.id
) pay on true;

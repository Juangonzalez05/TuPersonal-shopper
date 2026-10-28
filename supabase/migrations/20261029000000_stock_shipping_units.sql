-- =====================================================================
-- Envío estimado de las ventas del inventario: esos productos no llegaron en una
-- caja registrada, así que su envío real se estima con el costo por producto
-- promedio de las cajas (en la app). Aquí solo se agregan las unidades vendidas
-- del inventario con envío cobrado, como columna nueva al final de v_orders.
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
  t.stock_shipping_units
from public.orders o
left join lateral (
  select coalesce(sum(i.price_cop), 0)::bigint                                     as items_price_cop,
         coalesce(sum(i.cost_cop), 0)::bigint                                      as items_cost_cop,
         coalesce(sum(i.profit_cop), 0)::bigint                                    as items_profit_cop,
         coalesce(sum(i.shipping_charged_cop), 0)::bigint                          as shipping_charged_cop,
         count(*) filter (where i.incomplete)                                      as incomplete_items,
         coalesce(sum(i.shipping_charged_cop) filter (where i.from_stock), 0)::bigint as stock_shipping_cop,
         coalesce(sum(i.qty) filter (where i.from_stock and i.shipping_charged_cop > 0), 0)::int
                                                                                   as stock_shipping_units
  from public.v_order_items i
  where i.order_id = o.id
) t on true
left join lateral (
  select coalesce(sum(p.amount_cop), 0)::bigint as paid_cop
  from public.payments p
  where p.order_id = o.id
) pay on true;

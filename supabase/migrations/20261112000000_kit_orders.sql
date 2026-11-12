-- =====================================================================
-- Tipo de pedido: 'pedido' (lo de siempre) o 'kit' (una cajita con varios
-- productos a un precio fijo). Un kit se guarda con las mismas líneas:
--   - la línea del kit: nombre, cantidad de cajitas, precio c/u, sin costo;
--   - el contenido: cada producto con su costo y precio c/u = 0.
-- Las fórmulas no cambian: total = precio × cajitas, ganancia = total − costo.
--
-- v_orders se recrea para que o.* traiga la columna nueva.
-- =====================================================================

alter table public.orders
  add column kind text not null default 'pedido' check (kind in ('pedido', 'kit'));

drop view public.v_orders;

create view public.v_orders with (security_invoker = true) as
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

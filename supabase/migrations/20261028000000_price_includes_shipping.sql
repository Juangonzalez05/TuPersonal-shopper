-- =====================================================================
-- El precio c/u que ella escribe ya incluye el envío / gestión de la línea.
-- El envío ya no se suma encima: indica qué parte del precio es envío, para
-- comparar contra el costo de la caja.
--
--   lo que paga el cliente = precio c/u × cantidad
--   precio del producto    = precio c/u × cantidad − envío
--
-- v_orders sigue sumando productos + envío, así que su total es lo que paga el
-- cliente. Las líneas con % (fórmula del Excel) y las que no tienen precio no
-- cambian: el envío va encima del precio.
-- =====================================================================

create or replace view public.v_order_items with (security_invoker = true) as
select p.*,
       (p.price_cop - p.cost_cop) as profit_cop,
       case when p.cost_cop > 0 then round(p.price_cop::numeric / p.cost_cop - 1, 4) end as markup_effective
from (
  select c.*,
         case when c.unit_price_cop is not null then c.unit_price_cop * c.qty - c.shipping_charged_cop
              else round(c.cost_cop * (1 + coalesce(c.markup_pct, 0)), -2)::bigint
         end as price_cop
  from (
    select oi.*,
           round(oi.unit_cost_usd * oi.trm * oi.qty)::bigint as cost_cop,
           (oi.unit_cost_usd > 0
             and (oi.trm = 0 or (oi.markup_pct is null and oi.unit_price_cop is null))) as incomplete
    from public.order_items oi
  ) c
) p;

-- ---------- Abonos de "Pagado completo" -------------------------------
-- "Pagado completo" registraba el total con el envío sumado. Si el pedido tiene un
-- solo abono y es justo ese total viejo, se baja al total nuevo.

with totals as (
  select o.id as order_id,
         o.total_cop as new_total,
         o.total_cop + coalesce((select sum(i.shipping_charged_cop) from public.order_items i
                                 where i.order_id = o.id and i.unit_price_cop is not null), 0) as old_total
  from public.v_orders o
)
update public.payments p
set amount_cop = t.new_total
from totals t
where p.order_id = t.order_id
  and t.old_total > t.new_total
  and t.new_total > 0
  and p.amount_cop = t.old_total
  and (select count(*) from public.payments q where q.order_id = p.order_id) = 1;

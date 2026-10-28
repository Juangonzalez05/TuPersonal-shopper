-- =====================================================================
-- Ganancia de envíos por producto. El costo de la caja se divide entre los
-- productos que trae; cada producto de un pedido compara su envío cobrado (el
-- estimado que va dentro del precio) contra lo que le tocó de la caja:
--
--   productos en la caja = lo que ella escribe, nunca menos que lo registrado
--                          (unidades de pedidos + unidades de inventario)
--   costo por producto   = costo del envío / productos en la caja
--   envío real encargos  = costo del envío × unidades de pedidos / productos en la caja
--   ganancia de envíos   = envío cobrado a esos pedidos − envío real encargos
--   parte inventario     = costo del envío − envío real encargos (costo, no se compara)
--
-- Sin costo o sin productos no se puede dividir: la ganancia queda en null.
-- =====================================================================

alter table public.shipments
  add column products_count integer check (products_count > 0);  -- cuántos productos trae, según ella

-- ---------- Caja --------------------------------------------------------
-- s.* cambia con la columna nueva: la vista se borra y se vuelve a crear.

drop view public.v_shipments;

create view public.v_shipments with (security_invoker = true) as
select r.*,
       (r.charged_cop - r.clients_real_cop)    as difference_cop,
       (r.real_cost_cop - r.clients_real_cop)  as other_real_cop
from (
  select u.*,
         case when u.real_cost_cop is not null and u.units_total > 0
              then round(u.real_cost_cop::numeric / u.units_total)::bigint end                  as cost_per_unit_cop,
         case when u.real_cost_cop is not null and u.units_total > 0
              then round(u.real_cost_cop::numeric * u.client_units / u.units_total)::bigint end as clients_real_cop
  from (
    select s.*,
           x.items_count,
           x.client_units,
           x.charged_cop,
           case when s.arrived_on is null then 'en_camino' else 'llego' end         as state,
           st.stock_units,
           greatest(coalesce(s.products_count, 0), x.client_units + st.stock_units) as units_total
    from public.shipments s
    -- Líneas de pedidos de la caja (sin anulados).
    left join lateral (
      select count(*)::int                                     as items_count,
             coalesce(sum(oi.qty), 0)::int                     as client_units,
             coalesce(sum(oi.shipping_charged_cop), 0)::bigint as charged_cop
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.shipment_id = s.id
        and o.status <> 'anulado'
    ) x on true
    -- Unidades que la caja trae para el inventario.
    left join lateral (
      select coalesce(sum(m.qty), 0)::int as stock_units
      from public.stock_movements m
      where m.shipment_id = s.id
    ) st on true
  ) u
) r;

-- ---------- Pedido: envío cobrado en ventas del inventario --------------
-- Columna nueva al final (no se compara por ahora: el inventario no siempre llegó en una caja).

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
  t.stock_shipping_cop
from public.orders o
left join lateral (
  select coalesce(sum(i.price_cop), 0)::bigint                                     as items_price_cop,
         coalesce(sum(i.cost_cop), 0)::bigint                                      as items_cost_cop,
         coalesce(sum(i.profit_cop), 0)::bigint                                    as items_profit_cop,
         coalesce(sum(i.shipping_charged_cop), 0)::bigint                          as shipping_charged_cop,
         count(*) filter (where i.incomplete)                                      as incomplete_items,
         coalesce(sum(i.shipping_charged_cop) filter (where i.from_stock), 0)::bigint as stock_shipping_cop
  from public.v_order_items i
  where i.order_id = o.id
) t on true
left join lateral (
  select coalesce(sum(p.amount_cop), 0)::bigint as paid_cop
  from public.payments p
  where p.order_id = o.id
) pay on true;

-- ---------- create_shipment: también guarda cuántos productos trae ------

drop function public.create_shipment(text, text, date, date, bigint, text, jsonb);

create function public.create_shipment(
  p_code           text,
  p_carrier        text    default null,
  p_shipped_on     date    default null,
  p_expected_on    date    default null,
  p_real_cost_cop  bigint  default null,
  p_notes          text    default null,
  p_stock          jsonb   default '[]'::jsonb,
  p_products_count integer default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shipment_id uuid;
  v_product_id  uuid;
  v_code        text := upper(btrim(p_code));
  r             record;
begin
  if coalesce(v_code, '') = '' then
    raise exception 'Falta el código de la caja';
  end if;

  insert into public.shipments (code, carrier, shipped_on, expected_on, real_cost_cop, notes, products_count)
  values (v_code, nullif(btrim(p_carrier), ''), p_shipped_on, p_expected_on, p_real_cost_cop,
          nullif(btrim(p_notes), ''), p_products_count)
  returning id into v_shipment_id;

  for r in
    select * from jsonb_to_recordset(coalesce(p_stock, '[]'::jsonb))
      as i(product_id uuid, product_name text, qty integer, unit_cost_usd numeric)
  loop
    if coalesce(r.qty, 0) <= 0 then
      continue;
    end if;
    v_product_id := r.product_id;
    if v_product_id is null then
      if coalesce(btrim(r.product_name), '') = '' then
        raise exception 'Cada producto de la caja necesita un nombre';
      end if;
      select p.id into v_product_id from public.products p
       where lower(btrim(p.name)) = lower(regexp_replace(btrim(r.product_name), '\s+', ' ', 'g'))
       limit 1;
      if v_product_id is null then
        insert into public.products (name)
        values (regexp_replace(btrim(r.product_name), '\s+', ' ', 'g'))
        returning id into v_product_id;
      end if;
    end if;

    insert into public.stock_movements (product_id, kind, qty, unit_cost_usd, shipment_id, moved_on, note)
    values (v_product_id, 'ingreso', r.qty, r.unit_cost_usd, v_shipment_id,
            coalesce(p_shipped_on, (now() at time zone 'America/Bogota')::date),
            'Caja ' || v_code);
  end loop;

  return v_shipment_id;
end;
$$;

revoke execute on function public.create_shipment from public, anon;
grant execute on function public.create_shipment to authenticated;

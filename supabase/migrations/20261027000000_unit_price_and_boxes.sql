-- =====================================================================
-- Correcciones del flujo (uso real desde el celular):
--  1. Precio c/u al cliente: ella escribe el precio y el % sale solo.
--  2. update_order: editar un pedido guardado (sus líneas conservan la caja).
--  3. Cajas con despacho, llegada estimada y estado En camino / Llegó.
--  4. create_shipment: la caja trae productos que entran al inventario "en camino".
--  5. v_stock separa lo disponible de lo que viene en camino.
-- Las vistas usan "*" de sus tablas: al agregar columnas hay que recrearlas.
-- =====================================================================

drop view public.v_orders;
drop view public.v_order_items;
drop view public.v_shipments;
drop view public.v_stock;

-- ---------- Columnas nuevas -------------------------------------------

alter table public.order_items
  add column unit_price_cop bigint check (unit_price_cop >= 0);  -- precio c/u al cliente; null = usar el %

alter table public.shipments
  add column shipped_on  date,   -- cuándo la despacharon
  add column expected_on date;   -- llegada estimada (arrived_on = llegada real)

-- ---------- Línea de pedido -------------------------------------------
--   costo_total = ROUND(USD × TRM × cantidad)
--   precio      = precio c/u × cantidad   si ella lo escribió
--               = ROUND(costo × (1 + %), -2)   si no (fórmula del Excel)
--   incremento  = precio / costo − 1 (solo informativo)
--   incompleta  = hay costo y falta TRM, o faltan precio y %

create view public.v_order_items with (security_invoker = true) as
select p.*,
       (p.price_cop - p.cost_cop) as profit_cop,
       case when p.cost_cop > 0 then round(p.price_cop::numeric / p.cost_cop - 1, 4) end as markup_effective
from (
  select c.*,
         case when c.unit_price_cop is not null then c.unit_price_cop * c.qty
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

-- ---------- Pedido (igual que antes) ----------------------------------

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
  end as payment_status
from public.orders o
left join lateral (
  select coalesce(sum(i.price_cop), 0)::bigint            as items_price_cop,
         coalesce(sum(i.cost_cop), 0)::bigint             as items_cost_cop,
         coalesce(sum(i.profit_cop), 0)::bigint           as items_profit_cop,
         coalesce(sum(i.shipping_charged_cop), 0)::bigint as shipping_charged_cop,
         count(*) filter (where i.incomplete)             as incomplete_items
  from public.v_order_items i
  where i.order_id = o.id
) t on true
left join lateral (
  select coalesce(sum(p.amount_cop), 0)::bigint as paid_cop
  from public.payments p
  where p.order_id = o.id
) pay on true;

-- ---------- Caja --------------------------------------------------------
-- Estado por llegada: en_camino | llego. La ganancia de envío (cobrado − costo del envío)
-- se calcula apenas haya costo, esté o no en camino. No cuenta pedidos anulados.

create view public.v_shipments with (security_invoker = true) as
select
  s.*,
  x.items_count,
  x.charged_cop,
  case when s.arrived_on is null then 'en_camino' else 'llego' end as state,
  case when s.real_cost_cop is null then null
       else x.charged_cop - s.real_cost_cop end                    as difference_cop,
  coalesce((select sum(m.qty) from public.stock_movements m
            where m.shipment_id = s.id), 0)::int                    as stock_units
from public.shipments s
left join lateral (
  select count(*)::int                                     as items_count,
         coalesce(sum(oi.shipping_charged_cop), 0)::bigint as charged_cop
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.shipment_id = s.id
    and o.status <> 'anulado'
) x on true;

-- ---------- Inventario ------------------------------------------------
--   ingresado  = movimientos sin caja o de cajas que ya llegaron
--   en camino  = movimientos de cajas que aún no llegan
--   vendido    = líneas "sale del inventario" de pedidos Confirmado en adelante
--   disponible = ingresado − vendido
--   estado     = revisar (ni con lo en camino alcanza) | en_camino (no hay disponible pero viene)
--                | agotado | disponible

create view public.v_stock with (security_invoker = true) as
select s.*,
       (s.entered_qty - s.sold_qty) as available_qty,
       case when s.entered_qty + s.in_transit_qty - s.sold_qty < 0 then 'revisar'
            when s.entered_qty - s.sold_qty <= 0 and s.in_transit_qty > 0 then 'en_camino'
            when s.entered_qty - s.sold_qty = 0 then 'agotado'
            else 'disponible' end   as state
from (
  select p.id as product_id, p.owner_id, p.name,
         coalesce((select sum(m.qty) from public.stock_movements m
                   left join public.shipments sh on sh.id = m.shipment_id
                   where m.product_id = p.id
                     and (m.shipment_id is null or sh.arrived_on is not null)), 0)::int as entered_qty,
         coalesce((select sum(m.qty) from public.stock_movements m
                   join public.shipments sh on sh.id = m.shipment_id
                   where m.product_id = p.id and sh.arrived_on is null), 0)::int     as in_transit_qty,
         coalesce((select sum(oi.qty)
                   from public.order_items oi
                   join public.orders o on o.id = oi.order_id
                   where oi.product_id = p.id and oi.from_stock
                     and o.status not in ('anulado', 'cotizado')), 0)::int           as sold_qty
  from public.products p
) s;

-- ---------- create_order: acepta unit_price_cop -------------------------

create or replace function public.create_order(
  p_items               jsonb,                   -- [{product_id, description, qty, unit_cost_usd, trm, markup_pct, unit_price_cop, shipping_charged_cop, from_stock}]
  p_customer_id         uuid    default null,
  p_customer_name       text    default null,
  p_customer_phone      text    default null,
  p_ordered_on          date    default null,
  p_status              text    default 'cotizado',
  p_notes               text    default null,
  p_initial_payment_cop bigint  default 0,
  p_payment_method      text    default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid := p_customer_id;
  v_order_id    uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe tener al menos un producto';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as i(description text)
             where coalesce(btrim(i.description), '') = '') then
    raise exception 'Cada producto necesita una descripción';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as i(product_id uuid, from_stock boolean)
             where coalesce(i.from_stock, false) and i.product_id is null) then
    raise exception 'Para sacar del inventario elige un producto del catálogo';
  end if;
  if p_status not in ('cotizado', 'confirmado') then
    raise exception 'Estado inicial inválido: %', p_status;
  end if;

  if v_customer_id is null then
    if coalesce(btrim(p_customer_name), '') = '' then
      raise exception 'Falta el cliente';
    end if;
    insert into public.customers (name, phone)
    values (btrim(p_customer_name), nullif(btrim(p_customer_phone), ''))
    returning id into v_customer_id;
  end if;

  insert into public.orders (customer_id, ordered_on, status, notes)
  values (v_customer_id,
          coalesce(p_ordered_on, (now() at time zone 'America/Bogota')::date),
          p_status,
          nullif(btrim(p_notes), ''))
  returning id into v_order_id;

  insert into public.order_items
    (order_id, product_id, description, qty, unit_cost_usd, trm, markup_pct, unit_price_cop,
     shipping_charged_cop, from_stock)
  select v_order_id, i.product_id, btrim(i.description), i.qty,
         coalesce(i.unit_cost_usd, 0), coalesce(i.trm, 0), i.markup_pct, i.unit_price_cop,
         coalesce(i.shipping_charged_cop, 0), coalesce(i.from_stock, false)
  from jsonb_to_recordset(p_items) as i(
    product_id uuid, description text, qty integer, unit_cost_usd numeric, trm numeric,
    markup_pct numeric, unit_price_cop bigint, shipping_charged_cop bigint, from_stock boolean);

  -- % "aprendido": el producto que aún no tenía % sugerido se queda con el que se usó.
  update public.products p
     set default_markup = l.markup_pct
    from (select distinct on (oi.product_id) oi.product_id, oi.markup_pct
            from public.order_items oi
           where oi.order_id = v_order_id
             and oi.product_id is not null
             and oi.markup_pct is not null
           order by oi.product_id, oi.created_at) l
   where p.id = l.product_id
     and p.default_markup is null;

  if coalesce(p_initial_payment_cop, 0) > 0 then
    insert into public.payments (order_id, amount_cop, method)
    values (v_order_id, p_initial_payment_cop, nullif(btrim(p_payment_method), ''));
  end if;

  return v_order_id;
end;
$$;

-- ---------- update_order: editar un pedido guardado ---------------------
-- Las líneas con id se actualizan (conservan su caja), las sin id se insertan y las que
-- ya no vienen se borran. El estado de entrega y los abonos se cambian desde el detalle.

create function public.update_order(
  p_order_id       uuid,
  p_items          jsonb,                 -- [{id?, product_id, description, qty, unit_cost_usd, trm, markup_pct, unit_price_cop, shipping_charged_cop, from_stock}]
  p_customer_id    uuid default null,
  p_customer_name  text default null,
  p_customer_phone text default null,
  p_ordered_on     date default null,
  p_notes          text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid := p_customer_id;
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'El pedido no existe';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe tener al menos un producto';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as i(description text)
             where coalesce(btrim(i.description), '') = '') then
    raise exception 'Cada producto necesita una descripción';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as i(product_id uuid, from_stock boolean)
             where coalesce(i.from_stock, false) and i.product_id is null) then
    raise exception 'Para sacar del inventario elige un producto del catálogo';
  end if;

  if v_customer_id is null then
    if coalesce(btrim(p_customer_name), '') = '' then
      raise exception 'Falta el cliente';
    end if;
    insert into public.customers (name, phone)
    values (btrim(p_customer_name), nullif(btrim(p_customer_phone), ''))
    returning id into v_customer_id;
  end if;

  update public.orders
     set customer_id = v_customer_id,
         ordered_on  = coalesce(p_ordered_on, ordered_on),
         notes       = nullif(btrim(p_notes), '')
   where id = p_order_id;

  delete from public.order_items oi
   where oi.order_id = p_order_id
     and oi.id not in (select i.id from jsonb_to_recordset(p_items) as i(id uuid) where i.id is not null);

  update public.order_items oi
     set product_id           = i.product_id,
         description          = btrim(i.description),
         qty                  = i.qty,
         unit_cost_usd        = coalesce(i.unit_cost_usd, 0),
         trm                  = coalesce(i.trm, 0),
         markup_pct           = i.markup_pct,
         unit_price_cop       = i.unit_price_cop,
         shipping_charged_cop = coalesce(i.shipping_charged_cop, 0),
         from_stock           = coalesce(i.from_stock, false)
    from jsonb_to_recordset(p_items) as i(
      id uuid, product_id uuid, description text, qty integer, unit_cost_usd numeric, trm numeric,
      markup_pct numeric, unit_price_cop bigint, shipping_charged_cop bigint, from_stock boolean)
   where oi.id = i.id
     and oi.order_id = p_order_id;

  insert into public.order_items
    (order_id, product_id, description, qty, unit_cost_usd, trm, markup_pct, unit_price_cop,
     shipping_charged_cop, from_stock)
  select p_order_id, i.product_id, btrim(i.description), i.qty,
         coalesce(i.unit_cost_usd, 0), coalesce(i.trm, 0), i.markup_pct, i.unit_price_cop,
         coalesce(i.shipping_charged_cop, 0), coalesce(i.from_stock, false)
  from jsonb_to_recordset(p_items) as i(
    id uuid, product_id uuid, description text, qty integer, unit_cost_usd numeric, trm numeric,
    markup_pct numeric, unit_price_cop bigint, shipping_charged_cop bigint, from_stock boolean)
  where i.id is null;

  return p_order_id;
end;
$$;

revoke execute on function public.update_order from public, anon;
grant execute on function public.update_order to authenticated;

-- ---------- create_shipment: caja + productos que entran al inventario ---
-- p_stock: [{product_id?, product_name?, qty, unit_cost_usd?}]. Si no viene product_id se
-- busca por nombre y, si no existe, se crea el producto.

create function public.create_shipment(
  p_code          text,
  p_carrier       text   default null,
  p_shipped_on    date   default null,
  p_expected_on   date   default null,
  p_real_cost_cop bigint default null,
  p_notes         text   default null,
  p_stock         jsonb  default '[]'::jsonb
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

  insert into public.shipments (code, carrier, shipped_on, expected_on, real_cost_cop, notes)
  values (v_code, nullif(btrim(p_carrier), ''), p_shipped_on, p_expected_on, p_real_cost_cop,
          nullif(btrim(p_notes), ''))
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

-- =====================================================================
-- Inventario:
--  1. v_stock: una cotización no aparta unidades. Lo vendido cuenta las líneas
--     "sale del inventario" de pedidos Confirmado en adelante (ni cotizados ni anulados).
--  2. create_order acepta from_stock por línea; exige producto del catálogo.
-- Mismas columnas y misma firma: basta con create or replace.
-- =====================================================================

create or replace view public.v_stock with (security_invoker = true) as
select s.*,
       (s.entered_qty - s.sold_qty) as available_qty,
       case when s.entered_qty - s.sold_qty < 0 then 'revisar'
            when s.entered_qty - s.sold_qty = 0 then 'agotado'
            else 'disponible' end   as state
from (
  select p.id as product_id, p.owner_id, p.name,
         coalesce((select sum(m.qty) from public.stock_movements m
                   where m.product_id = p.id), 0)::int as entered_qty,
         coalesce((select sum(oi.qty)
                   from public.order_items oi
                   join public.orders o on o.id = oi.order_id
                   where oi.product_id = p.id and oi.from_stock
                     and o.status not in ('anulado', 'cotizado')), 0)::int as sold_qty
  from public.products p
) s;

create or replace function public.create_order(
  p_items               jsonb,                   -- [{product_id, description, qty, unit_cost_usd, trm, markup_pct, shipping_charged_cop, from_stock}]
  p_customer_id         uuid    default null,    -- cliente existente...
  p_customer_name       text    default null,    -- ...o uno nuevo
  p_customer_phone      text    default null,
  p_ordered_on          date    default null,    -- null = hoy en Bogotá
  p_status              text    default 'cotizado',
  p_notes               text    default null,
  p_initial_payment_cop bigint  default 0,       -- abono al registrar el pedido
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
    (order_id, product_id, description, qty, unit_cost_usd, trm, markup_pct, shipping_charged_cop, from_stock)
  select v_order_id,
         i.product_id,
         btrim(i.description),
         i.qty,
         coalesce(i.unit_cost_usd, 0),
         coalesce(i.trm, 0),
         i.markup_pct,
         coalesce(i.shipping_charged_cop, 0),
         coalesce(i.from_stock, false)
  from jsonb_to_recordset(p_items) as i(
    product_id uuid, description text, qty integer, unit_cost_usd numeric,
    trm numeric, markup_pct numeric, shipping_charged_cop bigint, from_stock boolean);

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

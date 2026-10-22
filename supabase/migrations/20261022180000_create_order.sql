-- =====================================================================
-- create_order: registra un pedido completo en UNA transacción
-- (cliente nuevo si hace falta, pedido, líneas, % aprendido y abono inicial).
-- security invoker => aplica RLS y owner_id sale de auth.uid() como en un
-- insert normal desde el front.
-- =====================================================================

create function public.create_order(
  p_items               jsonb,                   -- [{product_id, description, qty, unit_cost_usd, trm, markup_pct, shipping_charged_cop}]
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
    (order_id, product_id, description, qty, unit_cost_usd, trm, markup_pct, shipping_charged_cop)
  select v_order_id,
         i.product_id,
         btrim(i.description),
         i.qty,
         coalesce(i.unit_cost_usd, 0),
         coalesce(i.trm, 0),
         i.markup_pct,
         coalesce(i.shipping_charged_cop, 0)
  from jsonb_to_recordset(p_items) as i(
    product_id uuid, description text, qty integer, unit_cost_usd numeric,
    trm numeric, markup_pct numeric, shipping_charged_cop bigint);

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

revoke execute on function public.create_order from public, anon;
grant execute on function public.create_order to authenticated;

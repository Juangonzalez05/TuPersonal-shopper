-- Paridad de fórmulas: casos A, B y C de ROADMAP §4 contra v_order_items y v_orders.
-- Son los mismos números de src/lib/pricing.test.ts.
--
--   npx supabase db query --linked -f supabase/tests/pricing_views.sql
--
-- Sin error = las vistas coinciden. Si algo no cuadra, falla diciendo el caso y los valores.
-- No deja datos: el sub-bloque termina con una excepción propia que deshace todo lo insertado.
do $$
declare
  v_owner    uuid;
  v_customer uuid;
  v_a        uuid;
  v_b        uuid;
  v_c        uuid;
  v_got      text;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'No hay usuarios en auth.users para la prueba';
  end if;

  begin
    insert into public.customers (owner_id, name)
    values (v_owner, 'Prueba de paridad pricing') returning id into v_customer;
    insert into public.orders (owner_id, customer_id) values (v_owner, v_customer) returning id into v_a;
    insert into public.orders (owner_id, customer_id) values (v_owner, v_customer) returning id into v_b;
    insert into public.orders (owner_id, customer_id) values (v_owner, v_customer) returning id into v_c;

    insert into public.order_items
      (owner_id, order_id, description, qty, unit_cost_usd, trm, markup_pct, shipping_charged_cop)
    values (v_owner, v_a, 'Caso A', 2, 10,    4000,    0.40, 15000),
           (v_owner, v_b, 'Caso B', 1, 7.99,  4123.45, 0.40, 0),
           (v_owner, v_c, 'Caso C', 1, 0,     0,       null, 12000);
    insert into public.payments (owner_id, order_id, amount_cop)
    values (v_owner, v_a, 50000), (v_owner, v_c, 12000);

    -- Línea: costo / precio / ganancia / incompleta
    select format('%s/%s/%s/%s', cost_cop, price_cop, profit_cop, incomplete) into v_got
      from public.v_order_items where order_id = v_a;
    assert v_got = '80000/112000/32000/f', 'Caso A línea: ' || v_got;
    select format('%s/%s/%s/%s', cost_cop, price_cop, profit_cop, incomplete) into v_got
      from public.v_order_items where order_id = v_b;
    assert v_got = '32946/46100/13154/f', 'Caso B línea: ' || v_got;
    select format('%s/%s/%s/%s', cost_cop, price_cop, profit_cop, incomplete) into v_got
      from public.v_order_items where order_id = v_c;
    assert v_got = '0/0/0/f', 'Caso C línea: ' || v_got;

    -- Pedido: total / saldo / estado de pago
    select format('%s/%s/%s', total_cop, balance_cop, payment_status) into v_got
      from public.v_orders where id = v_a;
    assert v_got = '127000/77000/separado', 'Caso A pedido: ' || v_got;
    select format('%s/%s/%s', total_cop, balance_cop, payment_status) into v_got
      from public.v_orders where id = v_b;
    assert v_got = '46100/46100/pendiente', 'Caso B pedido: ' || v_got;
    select format('%s/%s/%s', total_cop, balance_cop, payment_status) into v_got
      from public.v_orders where id = v_c;
    assert v_got = '12000/0/pagado', 'Caso C pedido: ' || v_got;

    -- Caso A escrito con precio c/u (56.000) en vez de %: mismo precio y el 40 % sale solo.
    insert into public.order_items
      (owner_id, order_id, description, qty, unit_cost_usd, trm, unit_price_cop, shipping_charged_cop)
    values (v_owner, v_b, 'Caso A con precio', 2, 10, 4000, 56000, 0);
    select format('%s/%s/%s/%s/%s', cost_cop, price_cop, profit_cop, markup_effective, incomplete) into v_got
      from public.v_order_items where order_id = v_b and description = 'Caso A con precio';
    assert v_got = '80000/112000/32000/0.4000/f', 'Caso A con precio c/u: ' || v_got;

    -- Con costo pero sin precio ni %: incompleta.
    insert into public.order_items (owner_id, order_id, description, qty, unit_cost_usd, trm)
    values (v_owner, v_b, 'Sin precio', 1, 10, 4000);
    select format('%s/%s', price_cop, incomplete) into v_got
      from public.v_order_items where order_id = v_b and description = 'Sin precio';
    assert v_got = '40000/t', 'Sin precio: ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

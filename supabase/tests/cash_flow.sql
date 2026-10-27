-- v_cash_flow como la usa la app (rol authenticated + RLS): abonos y costo de cajas entran
-- solos, los movimientos anotados a mano con su signo, y una compra sobrevive al pedido.
--
--   npx supabase db query --linked -f supabase/tests/cash_flow.sql
--
-- Sin error = todo bien. No deja datos: el sub-bloque se deshace con una excepción propia.
-- Usa fechas de enero de 2001 para no mezclarse con los movimientos reales.
do $$
declare
  v_owner    uuid;
  v_order    uuid;
  v_purchase uuid;
  v_got      text;
begin
  select owner_id into v_owner from public.products limit 1;
  if v_owner is null then
    select id into v_owner from auth.users order by created_at limit 1;
  end if;

  begin
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    set local role authenticated;

    v_order := public.create_order(
      p_items => '[{"description":"Crema","qty":1,"unit_price_cop":120000}]'::jsonb,
      p_customer_name => 'Prueba flujo', p_ordered_on => '2001-01-02', p_status => 'confirmado');
    insert into public.payments (order_id, amount_cop, paid_on, method)
      values (v_order, 50000, '2001-01-05', 'Nequi');

    -- Caja con costo (cuenta en la fecha de despacho porque no ha llegado) y caja sin costo (no cuenta).
    insert into public.shipments (code, shipped_on, real_cost_cop) values ('PRUEBA-FLUJO', '2001-01-03', 30000);
    insert into public.shipments (code, shipped_on) values ('PRUEBA-FLUJO-SIN', '2001-01-03');

    insert into public.cash_movements (kind, amount_cop, moved_on, note)
      values ('aporte', 100000, '2001-01-01', 'Saldo inicial');
    insert into public.cash_movements (kind, amount_cop, moved_on, order_id)
      values ('reinversion', 80000, '2001-01-06', v_order) returning id into v_purchase;
    insert into public.cash_movements (kind, amount_cop, moved_on) values ('gasto', 5000, '2001-01-07');
    insert into public.cash_movements (kind, amount_cop, moved_on) values ('retiro', 20000, '2001-01-08');

    select string_agg(format('%s:%s:%s', source, direction, signed_cop), ' ' order by moved_on)
      into v_got from public.v_cash_flow where moved_on between '2001-01-01' and '2001-01-31';
    assert v_got = 'aporte:entrada:100000 envio:salida:-30000 abono:entrada:50000 '
                   'reinversion:salida:-80000 gasto:salida:-5000 retiro:salida:-20000',
      'Movimientos: ' || v_got;

    -- 100.000 + 50.000 − 30.000 − 80.000 − 5.000 − 20.000
    select sum(signed_cop)::text into v_got from public.v_cash_flow where moved_on between '2001-01-01' and '2001-01-31';
    assert v_got = '15000', 'Saldo: ' || v_got;

    select format('%s/%s', label, method) into v_got from public.v_cash_flow where source = 'abono' and order_id = v_order;
    assert v_got = 'Prueba flujo/Nequi', 'Abono (cliente / medio): ' || v_got;

    select label into v_got from public.v_cash_flow where id = v_purchase;
    assert v_got = 'Prueba flujo', 'Compra con pedido: ' || v_got;

    -- Solo se aceptan los cuatro tipos y valores positivos.
    begin
      insert into public.cash_movements (kind, amount_cop) values ('otro', 1000);
      assert false, 'Aceptó un tipo desconocido';
    exception when check_violation then null;
    end;
    begin
      insert into public.cash_movements (kind, amount_cop) values ('gasto', 0);
      assert false, 'Aceptó un valor en cero';
    exception when check_violation then null;
    end;

    -- Borrar el pedido se lleva su abono, pero la compra sigue (sin pedido).
    delete from public.orders where id = v_order;
    select format('%s/%s/%s', count(*) filter (where source = 'abono'),
                  bool_and(order_id is null) filter (where id = v_purchase),
                  coalesce(max(label) filter (where id = v_purchase), 'null'))
      into v_got from public.v_cash_flow where moved_on between '2001-01-01' and '2001-01-31';
    assert v_got = '0/t/null', 'Tras borrar el pedido (abonos / compra sin pedido / etiqueta): ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

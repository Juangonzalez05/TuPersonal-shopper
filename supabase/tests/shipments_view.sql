-- Caja de ejemplo contra v_shipments, con las fórmulas de la hoja "Control de envíos":
-- 2 líneas de un pedido activo (envío 15.000 + 12.000) y 1 de un pedido anulado (9.000),
-- que no debe contar.
--
--   npx supabase db query --linked -f supabase/tests/shipments_view.sql
--
-- Sin error = coincide. No deja datos: el sub-bloque se deshace con una excepción propia.
do $$
declare
  v_owner     uuid;
  v_customer  uuid;
  v_active    uuid;
  v_cancelled uuid;
  v_box       uuid;
  v_got       text;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'No hay usuarios en auth.users para la prueba';
  end if;

  begin
    insert into public.customers (owner_id, name)
    values (v_owner, 'Prueba de cajas') returning id into v_customer;
    insert into public.orders (owner_id, customer_id, status)
    values (v_owner, v_customer, 'en_transito') returning id into v_active;
    insert into public.orders (owner_id, customer_id, status)
    values (v_owner, v_customer, 'anulado') returning id into v_cancelled;
    insert into public.shipments (owner_id, code)
    values (v_owner, 'PRUEBA-CAJA') returning id into v_box;

    insert into public.order_items (owner_id, order_id, description, qty, shipping_charged_cop, shipment_id)
    values (v_owner, v_active,    'Línea 1', 2, 15000, v_box),
           (v_owner, v_active,    'Línea 2', 1, 12000, v_box),
           (v_owner, v_cancelled, 'Anulada', 1,  9000, v_box);

    -- Por cerrar: productos / cobrado / estado / diferencia
    select format('%s/%s/%s/%s', items_count, charged_cop, state, coalesce(difference_cop::text, 'null'))
      into v_got from public.v_shipments where id = v_box;
    assert v_got = '2/27000/por_cerrar/null', 'Caja por cerrar: ' || v_got;

    update public.shipments set real_cost_cop = 20000 where id = v_box;
    select format('%s/%s', state, difference_cop) into v_got from public.v_shipments where id = v_box;
    assert v_got = 'cerrada/7000', 'Caja con ganancia: ' || v_got;

    update public.shipments set real_cost_cop = 30000 where id = v_box;
    select format('%s/%s', state, difference_cop) into v_got from public.v_shipments where id = v_box;
    assert v_got = 'cerrada/-3000', 'Caja con pérdida: ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

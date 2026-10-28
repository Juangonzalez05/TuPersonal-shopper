-- Caja de ejemplo contra v_shipments, con las fórmulas de la hoja "Control de envíos":
-- 2 líneas de un pedido activo (envío 15.000 + 12.000) y 1 de un pedido anulado (9.000),
-- que no debe contar. Luego, la ganancia de envíos por producto: el costo de la caja se
-- divide entre los productos que trae y cada pedido compara su envío cobrado con su parte.
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
  v_box2      uuid;
  v_box3      uuid;
  v_product   uuid;
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

    -- En camino y sin costo: productos / cobrado / estado / diferencia
    select format('%s/%s/%s/%s', items_count, charged_cop, state, coalesce(difference_cop::text, 'null'))
      into v_got from public.v_shipments where id = v_box;
    assert v_got = '2/27000/en_camino/null', 'Caja sin costo: ' || v_got;

    update public.shipments set real_cost_cop = 20000 where id = v_box;
    select format('%s/%s', state, difference_cop) into v_got from public.v_shipments where id = v_box;
    assert v_got = 'en_camino/7000', 'Caja con ganancia (aún en camino): ' || v_got;

    update public.shipments set real_cost_cop = 30000, arrived_on = current_date where id = v_box;
    select format('%s/%s', state, difference_cop) into v_got from public.v_shipments where id = v_box;
    assert v_got = 'llego/-3000', 'Caja que llegó con pérdida: ' || v_got;

    -- Caja que trae 2 unidades de un pedido (60.000 de envío cobrado) y 3 para el inventario.
    insert into public.shipments (owner_id, code, real_cost_cop)
    values (v_owner, 'PRUEBA-CAJA-2', 309000) returning id into v_box2;
    insert into public.order_items (owner_id, order_id, description, qty, shipping_charged_cop, shipment_id)
    values (v_owner, v_active, 'Crema', 2, 60000, v_box2);
    insert into public.products (owner_id, name) values (v_owner, 'Producto de prueba de cajas')
    returning id into v_product;
    insert into public.stock_movements (owner_id, product_id, kind, qty, shipment_id)
    values (v_owner, v_product, 'ingreso', 3, v_box2);

    -- Sin número escrito: se divide entre lo registrado (2 + 3 = 5) → 61.800 c/u.
    select format('%s/%s/%s/%s/%s/%s', client_units, units_total, cost_per_unit_cop,
                  clients_real_cop, difference_cop, other_real_cop)
      into v_got from public.v_shipments where id = v_box2;
    assert v_got = '2/5/61800/123600/-63600/185400', 'Caja dividida entre lo registrado: ' || v_got;

    -- Ella escribe que trae 20 productos: 309.000 / 20 = 15.450 c/u; al pedido le tocan
    -- 2 × 15.450 = 30.900, gana 60.000 − 30.900 = 29.100; el resto (278.100) es inventario / otros.
    update public.shipments set products_count = 20 where id = v_box2;
    select format('%s/%s/%s/%s/%s', units_total, cost_per_unit_cop, clients_real_cop, difference_cop, other_real_cop)
      into v_got from public.v_shipments where id = v_box2;
    assert v_got = '20/15450/30900/29100/278100', 'Caja con 20 productos: ' || v_got;

    -- Si escribe menos de lo registrado, cuenta lo registrado.
    update public.shipments set products_count = 1 where id = v_box2;
    select units_total::text into v_got from public.v_shipments where id = v_box2;
    assert v_got = '5', 'Productos escritos por debajo de lo registrado: ' || v_got;

    -- Con costo pero sin productos no se puede dividir.
    insert into public.shipments (owner_id, code, real_cost_cop)
    values (v_owner, 'PRUEBA-CAJA-3', 50000) returning id into v_box3;
    select format('%s/%s/%s', units_total, coalesce(cost_per_unit_cop::text, 'null'), coalesce(difference_cop::text, 'null'))
      into v_got from public.v_shipments where id = v_box3;
    assert v_got = '0/null/null', 'Caja con costo y sin productos: ' || v_got;

    -- El envío cobrado en ventas del inventario se ve aparte en el pedido.
    insert into public.order_items (owner_id, order_id, description, qty, shipping_charged_cop, from_stock, product_id)
    values (v_owner, v_active, 'Del inventario', 1, 8000, true, v_product);
    select stock_shipping_cop::text into v_got from public.v_orders where id = v_active;
    assert v_got = '8000', 'Envío cobrado en ventas del inventario: ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

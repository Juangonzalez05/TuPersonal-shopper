-- create_shipment como la usa la app (rol authenticated + RLS): la caja trae un producto
-- existente y uno nuevo; ambos entran al inventario "en camino" y pasan a disponibles al llegar.
--
--   npx supabase db query --linked -f supabase/tests/create_shipment.sql
--
-- Sin error = todo bien. No deja datos: el sub-bloque se deshace con una excepción propia.
do $$
declare
  v_owner    uuid;
  v_product  uuid;
  v_box      uuid;
  v_new      uuid;
  v_before   int;
  v_got      text;
begin
  select owner_id, id into v_owner, v_product from public.products limit 1;
  if v_owner is null then
    raise exception 'La prueba necesita al menos un producto en el catálogo';
  end if;

  begin
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    set local role authenticated;

    select available_qty into v_before from public.v_stock where product_id = v_product;

    v_box := public.create_shipment(
      p_code => 'prueba-caja', p_carrier => 'Casillero', p_shipped_on => current_date,
      p_expected_on => current_date + 10, p_real_cost_cop => 50000,
      p_stock => jsonb_build_array(
        jsonb_build_object('product_id', v_product, 'qty', 2, 'unit_cost_usd', 5),
        jsonb_build_object('product_name', '  Producto   nuevo de prueba ', 'qty', 4)));

    select format('%s/%s/%s/%s', code, state, stock_units, real_cost_cop) into v_got
      from public.v_shipments where id = v_box;
    assert v_got = 'PRUEBA-CAJA/en_camino/6/50000', 'Caja creada: ' || v_got;

    select id into v_new from public.products where name = 'Producto nuevo de prueba';
    assert v_new is not null, 'No se creó el producto nuevo con el nombre normalizado';

    select format('%s/%s', available_qty - v_before, in_transit_qty) into v_got
      from public.v_stock where product_id = v_product;
    assert v_got = '0/2', 'Producto existente en camino: ' || v_got;

    update public.shipments set arrived_on = current_date where id = v_box;
    select format('%s/%s', available_qty - v_before, in_transit_qty) into v_got
      from public.v_stock where product_id = v_product;
    assert v_got = '2/0', 'Producto existente al llegar: ' || v_got;
    select format('%s/%s', available_qty, state) into v_got from public.v_stock where product_id = v_new;
    assert v_got = '4/disponible', 'Producto nuevo al llegar: ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

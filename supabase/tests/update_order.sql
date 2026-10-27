-- update_order como la usa la app (rol authenticated + RLS): editar una línea, agregar otra y
-- quitar otra; la línea editada conserva su caja y los totales se recalculan.
--
--   npx supabase db query --linked -f supabase/tests/update_order.sql
--
-- Sin error = todo bien. No deja datos: el sub-bloque se deshace con una excepción propia.
do $$
declare
  v_owner  uuid;
  v_order  uuid;
  v_box    uuid;
  v_keep   uuid;
  v_drop   uuid;
  v_got    text;
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
      p_items => '[{"description":"Crema","qty":2,"unit_cost_usd":10,"trm":4000,"unit_price_cop":56000,"shipping_charged_cop":15000},
                   {"description":"Se quita","qty":1,"unit_price_cop":10000}]'::jsonb,
      p_customer_name => 'Prueba editar pedido', p_status => 'confirmado');

    select id into v_keep from public.order_items where order_id = v_order and description = 'Crema';
    select id into v_drop from public.order_items where order_id = v_order and description = 'Se quita';
    insert into public.shipments (code) values ('PRUEBA-EDITAR') returning id into v_box;
    update public.order_items set shipment_id = v_box where id = v_keep;

    -- Editar: la crema pasa a 3 unidades a 60.000, se quita una línea y se agrega otra.
    perform public.update_order(
      p_order_id => v_order,
      p_items => jsonb_build_array(
        jsonb_build_object('id', v_keep, 'description', 'Crema', 'qty', 3, 'unit_cost_usd', 10,
                           'trm', 4000, 'unit_price_cop', 60000, 'shipping_charged_cop', 15000),
        jsonb_build_object('description', 'Nueva', 'qty', 1, 'unit_price_cop', 20000)),
      p_customer_id => (select customer_id from public.orders where id = v_order),
      p_notes => 'editado');

    select format('%s/%s', count(*), bool_or(id = v_drop)) into v_got
      from public.order_items where order_id = v_order;
    assert v_got = '2/f', 'Líneas tras editar: ' || v_got;

    select format('%s/%s', qty, shipment_id = v_box) into v_got from public.order_items where id = v_keep;
    assert v_got = '3/t', 'Línea editada (cantidad / conserva caja): ' || v_got;

    -- 3 × 60.000 + 20.000 + 15.000 de envío
    select format('%s/%s', total_cop, notes) into v_got from public.v_orders where id = v_order;
    assert v_got = '215000/editado', 'Total tras editar: ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

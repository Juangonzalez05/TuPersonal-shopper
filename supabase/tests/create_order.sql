-- Prueba de create_order como la usa la app: rol authenticated + RLS, con el caso A
-- (cliente nuevo, abono inicial) y el % aprendido. También comprueba que anon no puede llamarla.
--
--   npx supabase db query --linked -f supabase/tests/create_order.sql
--
-- Sin error = todo bien. No deja datos: el sub-bloque se deshace con una excepción propia.
do $$
declare
  v_owner   uuid;
  v_product uuid;
  v_any_product uuid;
  v_order   uuid;
  v_got     text;
  v_args    jsonb := jsonb_build_array(jsonb_build_object(
              'description', 'Caso A', 'qty', 2, 'unit_cost_usd', 10, 'trm', 4000,
              'markup_pct', 0.40, 'shipping_charged_cop', 15000));
begin
  -- La dueña del catálogo (la prueba necesita productos); si no hay, el primer usuario.
  select owner_id into v_owner from public.products limit 1;
  if v_owner is null then
    select id into v_owner from auth.users order by created_at limit 1;
  end if;
  if v_owner is null then
    raise exception 'No hay usuarios en auth.users para la prueba';
  end if;
  select id into v_product from public.products
   where owner_id = v_owner and default_markup is null limit 1;
  select id into v_any_product from public.products where owner_id = v_owner limit 1;
  if v_any_product is null then
    raise exception 'La prueba necesita al menos un producto en el catálogo';
  end if;

  begin
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    set local role authenticated;

    v_order := public.create_order(
      p_items               => jsonb_set(v_args, '{0,product_id}', to_jsonb(v_product)),
      p_customer_name       => '  Prueba create_order ',
      p_customer_phone      => '3001234567',
      p_status              => 'confirmado',
      p_initial_payment_cop => 50000,
      p_payment_method      => 'Nequi');

    select format('%s/%s/%s/%s/%s', status, total_cop, paid_cop, balance_cop, payment_status)
      into v_got from public.v_orders where id = v_order;
    assert v_got = 'confirmado/127000/50000/77000/separado', 'Pedido caso A: ' || v_got;

    select format('%s/%s', o.owner_id = v_owner, c.name) into v_got
      from public.orders o join public.customers c on c.id = o.customer_id where o.id = v_order;
    assert v_got = 't/Prueba create_order', 'Dueño y cliente: ' || v_got;

    if v_product is not null then
      select default_markup::text into v_got from public.products where id = v_product;
      assert v_got = '0.4000', '% aprendido: ' || coalesce(v_got, 'null');
    end if;

    -- Sin líneas debe fallar.
    begin
      perform public.create_order(p_items => '[]'::jsonb, p_customer_name => 'X');
      assert false, 'create_order aceptó un pedido sin productos';
    exception when raise_exception then null;
    end;

    -- "Sale del inventario" se guarda; sin producto del catálogo, falla.
    v_order := public.create_order(
      p_items => jsonb_build_array(jsonb_build_object(
        'product_id', v_any_product, 'description', 'De stock', 'qty', 1, 'from_stock', true)),
      p_customer_name => 'Prueba stock');
    assert (select bool_and(from_stock) from public.order_items where order_id = v_order),
           'from_stock no se guardó';
    begin
      perform public.create_order(
        p_items => jsonb_build_array(jsonb_build_object('description', 'Sin producto', 'qty', 1, 'from_stock', true)),
        p_customer_name => 'X');
      assert false, 'create_order aceptó sacar del inventario sin producto';
    exception when raise_exception then null;
    end;

    -- anon no puede ejecutarla.
    set local role anon;
    begin
      perform public.create_order(p_items => v_args, p_customer_name => 'X');
      assert false, 'anon pudo ejecutar create_order';
    exception when insufficient_privilege then null;
    end;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

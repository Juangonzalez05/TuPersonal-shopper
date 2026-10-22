-- Inventario contra v_stock: ingresado (ingresos + ajustes) − vendido (líneas "sale del
-- inventario" de pedidos Confirmado en adelante; las cotizaciones y anulados no descuentan).
--
--   npx supabase db query --linked -f supabase/tests/stock_view.sql
--
-- Sin error = coincide. No deja datos: el sub-bloque se deshace con una excepción propia.
do $$
declare
  v_owner     uuid;
  v_customer  uuid;
  v_product   uuid;
  v_confirmed uuid;
  v_quote     uuid;
  v_cancelled uuid;
  v_got       text;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'No hay usuarios en auth.users para la prueba';
  end if;

  begin
    insert into public.customers (owner_id, name)
    values (v_owner, 'Prueba de inventario') returning id into v_customer;
    insert into public.products (owner_id, name)
    values (v_owner, 'Producto de prueba de inventario') returning id into v_product;
    insert into public.orders (owner_id, customer_id, status)
    values (v_owner, v_customer, 'confirmado') returning id into v_confirmed;
    insert into public.orders (owner_id, customer_id, status)
    values (v_owner, v_customer, 'cotizado') returning id into v_quote;
    insert into public.orders (owner_id, customer_id, status)
    values (v_owner, v_customer, 'anulado') returning id into v_cancelled;

    insert into public.stock_movements (owner_id, product_id, kind, qty)
    values (v_owner, v_product, 'ingreso', 5),
           (v_owner, v_product, 'ajuste', -1);
    insert into public.order_items (owner_id, order_id, product_id, description, qty, from_stock)
    values (v_owner, v_confirmed, v_product, 'Venta', 2, true),
           (v_owner, v_quote,     v_product, 'Cotización', 1, true),
           (v_owner, v_cancelled, v_product, 'Anulada', 1, true),
           (v_owner, v_confirmed, v_product, 'Por encargo', 3, false);

    -- ingresado / vendido / disponible / estado
    select format('%s/%s/%s/%s', entered_qty, sold_qty, available_qty, state)
      into v_got from public.v_stock where product_id = v_product;
    assert v_got = '4/2/2/disponible', 'Disponible: ' || v_got;

    insert into public.order_items (owner_id, order_id, product_id, description, qty, from_stock)
    values (v_owner, v_confirmed, v_product, 'Venta 2', 2, true);
    select format('%s/%s', available_qty, state) into v_got from public.v_stock where product_id = v_product;
    assert v_got = '0/agotado', 'Agotado: ' || v_got;

    insert into public.order_items (owner_id, order_id, product_id, description, qty, from_stock)
    values (v_owner, v_confirmed, v_product, 'Venta 3', 1, true);
    select format('%s/%s', available_qty, state) into v_got from public.v_stock where product_id = v_product;
    assert v_got = '-1/revisar', 'Por revisar: ' || v_got;

    -- Al confirmar la cotización, sus unidades sí descuentan.
    update public.orders set status = 'confirmado' where id = v_quote;
    select format('%s/%s', sold_qty, available_qty) into v_got from public.v_stock where product_id = v_product;
    assert v_got = '6/-2', 'Cotización confirmada: ' || v_got;

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

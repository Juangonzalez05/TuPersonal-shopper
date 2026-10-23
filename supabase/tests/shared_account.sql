-- Cuenta compartida: un miembro ve y crea datos de la cuenta dueña; el dueño ve lo que
-- crea el miembro; alguien sin membresía no ve nada del dueño. Usa la primera membresía
-- que exista en account_members (no trae correos, el repo es público).
--
--   npx supabase db query --linked -f supabase/tests/shared_account.sql
--
-- Sin error = todo bien. No deja datos: el sub-bloque se deshace con una excepción propia.
do $$
declare
  v_member    uuid;
  v_owner     uuid;
  v_outsider  uuid := gen_random_uuid();  -- un usuario cualquiera sin membresía
  v_products  bigint;
  v_customer  uuid;
  v_got       text;
begin
  select member_id, owner_id into v_member, v_owner from public.account_members limit 1;
  if v_member is null then
    raise exception 'No hay ninguna membresía en account_members para probar';
  end if;
  select count(*) into v_products from public.products where owner_id = v_owner;

  begin
    -- Como miembro.
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
    set local role authenticated;

    assert public.current_owner_id() = v_owner, 'current_owner_id del miembro no es el dueño';
    select count(*)::text into v_got from public.products;
    assert v_got = v_products::text, format('El miembro ve %s productos, el dueño tiene %s', v_got, v_products);

    insert into public.customers (name) values ('Prueba cuenta compartida') returning id into v_customer;
    select (owner_id = v_owner)::text into v_got from public.customers where id = v_customer;
    assert v_got = 'true', 'Lo que crea el miembro no quedó a nombre del dueño';

    -- Como dueño: ve lo que creó el miembro.
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    assert exists (select 1 from public.customers where id = v_customer), 'El dueño no ve lo que creó el miembro';

    -- Como alguien sin membresía: no ve nada del dueño.
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
    assert public.current_owner_id() = v_outsider, 'current_owner_id de un externo no es él mismo';
    assert not exists (select 1 from public.customers where id = v_customer), 'Un externo ve datos del dueño';
    assert (select count(*) from public.products) = 0, 'Un externo ve productos del dueño';

    raise exception 'deshacer datos de prueba' using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then null;  -- todo lo de arriba queda deshecho
  end;
end $$;

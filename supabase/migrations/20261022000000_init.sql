-- =====================================================================
-- Tu Shopper USA — migración inicial (Supabase / Postgres 15+)
-- Ubicación en el repo: supabase/migrations/<timestamp>_init.sql
-- Las fórmulas de las vistas replican EXACTAMENTE las del Excel.
-- Dinero en COP = bigint (sin decimales). USD = numeric(10,2).
-- Porcentajes como fracción: 0.40 = 40 %.
-- =====================================================================

-- ---------- Tablas ---------------------------------------------------

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,                       -- WhatsApp, para enviar cobros/estados
  notes      text,
  created_at timestamptz not null default now()
);

-- Catálogo "vivo": se llena con lo que ella va trayendo. No es una tienda.
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  brand          text,
  category       text,
  default_markup numeric(6,4),           -- % de incremento sugerido (0.40 = 40 %)
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create unique index products_owner_name_uq
  on public.products (owner_id, lower(btrim(name)));

-- Una "caja" = un envío físico con productos de varios clientes/proveedores.
create table public.shipments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code          text not null,           -- p. ej. ENV-001
  carrier       text,                    -- casillero / courier
  arrived_on    date,
  real_cost_cop bigint check (real_cost_cop >= 0),  -- NULL = "por cerrar"
  notes         text,
  created_at    timestamptz not null default now(),
  unique (owner_id, code)
);

-- Un pedido = un cliente + varios productos (en el Excel era una fila por producto).
create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  ordered_on  date not null default ((now() at time zone 'America/Bogota')::date),
  -- Estado de ENTREGA (manual). El estado de PAGO se deriva en v_orders.
  -- OJO: en Colombia "cancelado" = "pagado". Para un pedido anulado usamos 'anulado'.
  status      text not null default 'cotizado'
              check (status in ('cotizado','confirmado','comprado','en_transito',
                                'en_colombia','entregado','anulado')),
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id             uuid not null references public.orders(id) on delete cascade,
  product_id           uuid references public.products(id) on delete set null,
  description          text not null,    -- nombre tal como se vendió (snapshot)
  qty                  integer not null check (qty > 0),
  unit_cost_usd        numeric(10,2) not null default 0 check (unit_cost_usd >= 0), -- 0 = producto sin costo
  trm                  numeric(10,2) not null default 0 check (trm >= 0),
  markup_pct           numeric(6,4)  check (markup_pct >= 0),   -- NULL = falta definirlo
  shipping_charged_cop bigint not null default 0 check (shipping_charged_cop >= 0), -- envío/gestión cobrado por esta línea
  store                text,             -- Amazon, Walmart, etc.
  from_stock           boolean not null default false,          -- true = sale del inventario
  shipment_id          uuid references public.shipments(id) on delete set null,
  created_at           timestamptz not null default now()
);

-- Abonos: varios pagos por pedido (el Excel solo permitía un número).
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  amount_cop bigint not null check (amount_cop > 0),
  paid_on    date not null default ((now() at time zone 'America/Bogota')::date),
  method     text,                       -- efectivo, Nequi, transferencia...
  note       text,
  created_at timestamptz not null default now()
);

-- Entradas/ajustes de inventario. Las ventas con from_stock = true descuentan solas.
create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  kind          text not null check (kind in ('ingreso','ajuste')),
  qty           integer not null check (qty <> 0),   -- ajuste puede ser negativo
  unit_cost_usd numeric(10,2),
  trm           numeric(10,2),
  shipment_id   uuid references public.shipments(id) on delete set null,
  moved_on      date not null default ((now() at time zone 'America/Bogota')::date),
  note          text,
  created_at    timestamptz not null default now()
);

-- ---------- Índices de llaves foráneas -------------------------------

create index orders_customer_idx         on public.orders (customer_id);
create index order_items_order_idx       on public.order_items (order_id);
create index order_items_product_idx     on public.order_items (product_id);
create index order_items_shipment_idx    on public.order_items (shipment_id);
create index payments_order_idx          on public.payments (order_id);
create index stock_movements_product_idx on public.stock_movements (product_id);

-- ---------- Seguridad: RLS, solo el dueño ve/edita sus filas ---------
-- En el panel de Supabase: Authentication > desactivar "Allow new users to sign up"
-- y crear manualmente los usuarios (ella y tú).

do $$
declare t text;
begin
  foreach t in array array['customers','products','shipments','orders',
                           'order_items','payments','stock_movements']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index %I on public.%I (owner_id)', t || '_owner_idx', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------- Vistas de cálculo (security_invoker => respetan RLS) -----

-- Línea de pedido con costo, precio y ganancia (fórmulas del Excel):
--   costo_total  = ROUND(USD * TRM * cantidad)
--   precio       = ROUND(costo_total * (1 + %), -2)      -- a la centena
--   ganancia     = precio - costo_total
--   incompleta   = hay costo en USD pero falta TRM o %
create view public.v_order_items with (security_invoker = true) as
select p.*, (p.price_cop - p.cost_cop) as profit_cop
from (
  select c.*,
         round(c.cost_cop * (1 + coalesce(c.markup_pct, 0)), -2)::bigint as price_cop
  from (
    select oi.*,
           round(oi.unit_cost_usd * oi.trm * oi.qty)::bigint as cost_cop,
           (oi.unit_cost_usd > 0 and (oi.trm = 0 or oi.markup_pct is null)) as incomplete
    from public.order_items oi
  ) c
) p;

-- Pedido con totales y estado de pago:
--   total  = suma(precio líneas) + suma(envío cobrado líneas)
--   saldo  = total - abonos
--   pago   = pagado (saldo <= 0) | separado (hay abono) | pendiente
create view public.v_orders with (security_invoker = true) as
select
  o.*,
  t.items_price_cop,
  t.items_cost_cop,
  t.items_profit_cop,
  t.shipping_charged_cop,
  t.incomplete_items,
  (t.items_price_cop + t.shipping_charged_cop)                 as total_cop,
  pay.paid_cop,
  (t.items_price_cop + t.shipping_charged_cop - pay.paid_cop)  as balance_cop,
  case
    when (t.items_price_cop + t.shipping_charged_cop - pay.paid_cop) <= 0 then 'pagado'
    when pay.paid_cop > 0 then 'separado'
    else 'pendiente'
  end as payment_status
from public.orders o
left join lateral (
  select coalesce(sum(i.price_cop), 0)::bigint            as items_price_cop,
         coalesce(sum(i.cost_cop), 0)::bigint             as items_cost_cop,
         coalesce(sum(i.profit_cop), 0)::bigint           as items_profit_cop,
         coalesce(sum(i.shipping_charged_cop), 0)::bigint as shipping_charged_cop,
         count(*) filter (where i.incomplete)             as incomplete_items
  from public.v_order_items i
  where i.order_id = o.id
) t on true
left join lateral (
  select coalesce(sum(p.amount_cop), 0)::bigint as paid_cop
  from public.payments p
  where p.order_id = o.id
) pay on true;

-- Caja: lo cobrado por envío a los clientes de esa caja vs. lo que costó de verdad.
-- La comparación es por caja completa (no se reparte producto por producto).
-- TODO (Claude Code): excluir líneas de pedidos con status = 'anulado'.
create view public.v_shipments with (security_invoker = true) as
select
  s.*,
  x.items_count,
  x.charged_cop,
  case when s.real_cost_cop is null then 'por_cerrar' else 'cerrada' end as state,
  case when s.real_cost_cop is null then null
       else x.charged_cop - s.real_cost_cop end                          as difference_cop
from public.shipments s
left join lateral (
  select count(*)::int                                   as items_count,
         coalesce(sum(oi.shipping_charged_cop), 0)::bigint as charged_cop
  from public.order_items oi
  where oi.shipment_id = s.id
) x on true;

-- Inventario: ingresado (movimientos) - vendido (líneas from_stock de pedidos no anulados).
create view public.v_stock with (security_invoker = true) as
select s.*,
       (s.entered_qty - s.sold_qty) as available_qty,
       case when s.entered_qty - s.sold_qty < 0 then 'revisar'
            when s.entered_qty - s.sold_qty = 0 then 'agotado'
            else 'disponible' end   as state
from (
  select p.id as product_id, p.owner_id, p.name,
         coalesce((select sum(m.qty) from public.stock_movements m
                   where m.product_id = p.id), 0)::int as entered_qty,
         coalesce((select sum(oi.qty)
                   from public.order_items oi
                   join public.orders o on o.id = oi.order_id
                   where oi.product_id = p.id and oi.from_stock
                     and o.status <> 'anulado'), 0)::int as sold_qty
  from public.products p
) s;

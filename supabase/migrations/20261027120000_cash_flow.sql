-- =====================================================================
-- Flujo de caja: todo lo que entra y sale de la plata del negocio, con un solo saldo.
--  - cash_movements: lo que ella anota a mano (reinversión, gasto, retiro, aporte).
--  - v_cash_flow: eso + los abonos de clientes + el costo de envío de las cajas,
--    que ya se registran en sus pantallas y no se vuelven a digitar.
-- =====================================================================

create table public.cash_movements (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default public.current_owner_id() references auth.users(id) on delete cascade,
  -- reinversion = compras de productos para pedidos o inventario; retiro = plata que ella
  -- saca para sí; aporte = plata propia que mete (incluido el saldo inicial).
  kind       text not null check (kind in ('reinversion','gasto','retiro','aporte')),
  amount_cop bigint not null check (amount_cop > 0),
  moved_on   date not null default ((now() at time zone 'America/Bogota')::date),
  -- Compra vinculada a un pedido (opcional). Si se borra el pedido, la compra sigue contando.
  order_id   uuid references public.orders(id) on delete set null,
  method     text,
  note       text,
  created_at timestamptz not null default now()
);

create index cash_movements_owner_idx on public.cash_movements (owner_id);
create index cash_movements_owner_moved_idx on public.cash_movements (owner_id, moved_on);
create index cash_movements_order_idx on public.cash_movements (order_id);

alter table public.cash_movements enable row level security;

create policy "owner_all" on public.cash_movements for all to authenticated
  using (owner_id = (select public.current_owner_id()))
  with check (owner_id = (select public.current_owner_id()));

revoke all on public.cash_movements from anon;

-- ---------- Flujo de caja: una fila por movimiento --------------------
--   direction = entrada | salida;  signed_cop = + si entra, − si sale
--   abono: todos los abonos, también los de pedidos anulados (la plata sí entró)
--   envio: cajas con costo, fechadas en la llegada, si no el despacho, si no la creación

create view public.v_cash_flow with (security_invoker = true) as
select p.id,
       p.owner_id,
       'abono'::text   as source,
       'entrada'::text as direction,
       p.amount_cop,
       p.amount_cop    as signed_cop,
       p.paid_on       as moved_on,
       p.order_id,
       null::uuid      as shipment_id,
       c.name          as label,
       p.method,
       p.note,
       p.created_at
from public.payments p
join public.orders o on o.id = p.order_id
join public.customers c on c.id = o.customer_id

union all

select s.id,
       s.owner_id,
       'envio',
       'salida',
       s.real_cost_cop,
       -s.real_cost_cop,
       coalesce(s.arrived_on, s.shipped_on, (s.created_at at time zone 'America/Bogota')::date),
       null,
       s.id,
       s.code,
       null,
       null,
       s.created_at
from public.shipments s
where s.real_cost_cop > 0

union all

select m.id,
       m.owner_id,
       m.kind,
       case when m.kind = 'aporte' then 'entrada' else 'salida' end,
       m.amount_cop,
       case when m.kind = 'aporte' then m.amount_cop else -m.amount_cop end,
       m.moved_on,
       m.order_id,
       null,
       c.name,
       m.method,
       m.note,
       m.created_at
from public.cash_movements m
left join public.orders o on o.id = m.order_id
left join public.customers c on c.id = o.customer_id;

revoke all on public.v_cash_flow from anon;

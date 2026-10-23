-- =====================================================================
-- Cuentas compartidas: un "miembro" trabaja sobre los datos de la cuenta dueña.
-- Todo sigue siendo por owner_id, pero el dueño efectivo de quien inicia sesión es
-- public.current_owner_id(): su dueño si es miembro, o él mismo si no.
--
-- Los miembros se agregan por SQL (nunca desde la app). Ver CLAUDE.md.
-- =====================================================================

create table public.account_members (
  member_id  uuid primary key references auth.users(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (member_id <> owner_id)
);

alter table public.account_members enable row level security;

-- Cada quien solo puede leer su propia membresía. Sin políticas de escritura.
create policy "member_reads_own" on public.account_members
  for select to authenticated
  using (member_id = (select auth.uid()));

-- security definer: se usa dentro de las políticas de RLS y como default de owner_id,
-- así que lee account_members sin volver a pasar por RLS. Solo mira la fila de auth.uid().
create function public.current_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.owner_id from public.account_members m where m.member_id = auth.uid()),
    auth.uid()
  )
$$;

revoke execute on function public.current_owner_id() from public, anon;
grant execute on function public.current_owner_id() to authenticated;

-- Las 7 tablas: el dueño por defecto y la política pasan a usar current_owner_id().
do $$
declare t text;
begin
  foreach t in array array['customers','products','shipments','orders',
                           'order_items','payments','stock_movements']
  loop
    execute format('alter table public.%I alter column owner_id set default public.current_owner_id()', t);
    execute format('drop policy "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using (owner_id = (select public.current_owner_id()))
         with check (owner_id = (select public.current_owner_id()))', t);
  end loop;
end $$;

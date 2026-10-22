# Tu Shopper USA — contexto para Claude Code

## Qué es
App web **móvil-first (PWA)** para una personal shopper en Colombia que trae productos de EE. UU. (Amazon, Walmart, etc.) por encargo. Reemplaza el Excel `docs/Tu_Shopper_USA_Contabilidad.xlsx`. Un solo negocio, 1–2 usuarios. Lee `ROADMAP.md` antes de empezar cualquier fase.

## Stack (no cambiar sin preguntar)
- Vite + React + TypeScript, React Router, TanStack Query
- Tailwind + shadcn/ui, react-hook-form + zod
- Supabase: Postgres + Auth + RLS (sin backend propio; solo Edge Functions si hace falta)
- vite-plugin-pwa, Vitest, deploy en Vercel

## Reglas de oro
1. **Dinero**: COP siempre entero (`bigint` en BD, `number` entero en TS), nunca decimales. USD con 2 decimales. Porcentajes como fracción (0.40 = 40 %).
2. **Las fórmulas son las del Excel** (ver `ROADMAP.md` §4). Viven en las vistas SQL (`v_order_items`, `v_orders`, `v_shipments`, `v_stock`) y en UNA función TS pura `src/lib/pricing.ts` para el cálculo en vivo del formulario. Ambas deben coincidir; hay tests con los casos del roadmap.
3. **Seguridad**: RLS activo en todas las tablas, políticas por `owner_id`. En el front solo la `anon key`; **jamás** la `service_role`. Registro público desactivado.
4. **Migraciones**: todo cambio de esquema va en `supabase/migrations/` con archivo nuevo. No editar migraciones ya aplicadas. Regenerar tipos TS tras cada cambio.
5. **Vocabulario**: en Colombia "cancelado" = "pagado". Estado de pago: `pendiente | separado | pagado`. Pedido anulado = `anulado`.
6. **UI en español (es-CO)**: miles con punto (`1.234.567`), fechas `dd/MM/yyyy`, zona `America/Bogota`. Inputs numéricos con `inputMode="decimal"`. Botones grandes, navegación inferior, funcionar bien a 360 px de ancho.
7. **Simplicidad**: es una herramienta para una persona que registra rápido desde el celular. Pocos campos obligatorios, valores por defecto inteligentes (última TRM usada, % sugerido), cero pantallas de configuración innecesarias.

## Flujo de trabajo
- Una fase del roadmap por rama/sesión; usa modo plan antes de codificar fases grandes.
- Tests primero para `pricing.ts`. Corre `npm run lint && npm run test && npm run build` antes de cerrar una fase.
- Commits pequeños y descriptivos al terminar cada pantalla.

## Comandos (ajustar al crear el proyecto)
- `npm run dev` · `npm run test` · `npm run build`
- `supabase db push` (aplicar migraciones) · `supabase gen types typescript --linked > src/types/database.ts`

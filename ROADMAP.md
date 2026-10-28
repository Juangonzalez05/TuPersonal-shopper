# Roadmap — Tu Shopper USA (app de control de pedidos, envíos e inventario)

## 1. Qué construimos (y qué no)

**Sí:** una app que se usa desde el celular para registrar pedidos, abonos, cajas de envío e inventario, y que calcula sola la ganancia. Reemplaza el Excel actual con los mismos números.

**No (todavía):** tienda online, carrito, pasarela de pagos, bot de WhatsApp. Los clientes siguen llegando por WhatsApp y no hay catálogo fijo: los productos son los que ella va trayendo o le piden.

**Criterio de éxito del MVP:** registrar un pedido de 3 productos desde el celular en menos de 1 minuto, y que los totales coincidan con el Excel.

## 2. Cómo funciona su negocio (lo que revela el Excel)

Hojas actuales: `Productos y ventas` (una fila por producto pedido), `Control de envíos` (una fila por caja), `Inventario` (101 productos / 236 unidades cargados; **no hay ventas históricas**, así que la migración es solo inventario) y `Resumen` (todo calculado).

Flujo real:
1. Un cliente ve un producto (p. ej. una crema Medicube) y se lo pide por WhatsApp.
2. Ella busca dónde comprarlo y cotiza: **costo real** (USD × TRM) y **valor comercial** (costo × (1 + % incremento)).
3. El cliente abona ("separa") o paga completo.
4. Ella compra en Amazon u otro proveedor; los productos de varios clientes viajan juntos en una **caja**.
5. Cuando la caja llega, registra el **costo real de la caja** y se compara contra lo que cobró de envío/gestión a los clientes de esa caja (la comparación es por caja completa, no por producto).
6. Algunos productos no tienen costo para ella (los trae el cliente o son regalo): solo cobra envío/gestión.

## 3. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Frontend | Vite + React + TS + Tailwind + shadcn/ui, como **PWA** | Sin servidor propio; se instala en el celular como app; encaja con tu stack |
| Datos/Auth | **Supabase** (Postgres, Auth, RLS) directo desde el cliente | Menos piezas; la seguridad la da RLS |
| Hosting | Vercel (o Netlify/Cloudflare Pages) | Deploy automático desde GitHub, plan gratis suficiente |
| Cálculos | Vistas SQL + una función TS pura con los mismos tests | Un solo resultado en BD y en el formulario en vivo |
| Registro | Público **desactivado**; usuarios creados a mano | Es una app privada de una persona |

**Ojo con Supabase gratis** (verificado en 2026): los proyectos del plan gratuito **se pausan tras 7 días sin actividad** y requieren reactivación manual, y el plan gratis **no incluye backups automáticos** (los diarios llegan con Pro, ~USD 25/mes). Para un negocio real: o pasan a Pro cuando la app ya sea el sistema oficial, o hacen un respaldo propio (botón "Exportar CSV" + un GitHub Action semanal que también haga una consulta ligera para que el proyecto no se pause). Decídanlo antes de dejar el Excel.

Si usas el MCP de Supabase con Claude Code, conéctalo solo a un proyecto de **desarrollo**, no al de producción con datos reales.

## 4. Fórmulas (idénticas al Excel) y casos de prueba

```
costo_total  = ROUND(USD_unitario × TRM × cantidad)
precio       = ROUND(costo_total × (1 + %), -2)        // a la centena
total_pagar  = precio + envío_cobrado
saldo        = total_pagar − abonos
ganancia_producto = precio − costo_total
costo_por_producto = costo_real_caja / productos_en_la_caja   // los escribe ella; nunca menos que lo registrado
ganancia_envío (por caja) = Σ envío_cobrado de sus pedidos − costo_real_caja × unidades_de_pedidos / productos_en_la_caja
estado_pago  = pagado (saldo ≤ 0) | separado (hay abono) | pendiente
incompleta   = USD > 0 y (TRM = 0 o % vacío)
```

| Caso | USD | TRM | Cant. | % | Envío | Abono | Costo | Precio | Ganancia | Total | Saldo | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 10 | 4000 | 2 | 40 % | 15.000 | 50.000 | 80.000 | 112.000 | 32.000 | 127.000 | 77.000 | separado |
| B (redondeo) | 7,99 | 4123,45 | 1 | 40 % | 0 | 0 | 32.946 | 46.100 | 13.154 | 46.100 | 46.100 | pendiente |
| C (sin costo) | 0 | 0 | 1 | — | 12.000 | 12.000 | 0 | 0 | 0 | 12.000 | 0 | pagado |

Estos tres casos van como tests en `pricing.test.ts` y contra las vistas SQL.

**Precio c/u (como se registra hoy en la app).** Si ella escribe el precio c/u al cliente, ese precio **ya incluye el envío/gestión** de la línea:

```
lo que paga el cliente = precio_cu × cantidad            // el envío no se suma encima
precio (del producto)  = precio_cu × cantidad − envío_cobrado
ganancia_producto      = precio − costo_total
```

El envío cobrado indica qué parte del precio es envío y sigue contando en la ganancia de envío de su caja: es un estimado que se compara con lo que le tocó al producto de la caja (costo de la caja ÷ productos que trae). La parte de la caja que no es de pedidos (inventario / otros) y el envío cobrado en ventas del inventario se muestran aparte, sin comparar por ahora. Las líneas con % (casos A–C) mantienen la regla del Excel. Ejemplo: el caso A escrito como 63.500 c/u con 15.000 de envío da el mismo costo 80.000, precio 112.000, ganancia 32.000 y total 127.000.

## 5. Fases (con prompts para Claude Code)

Trabaja **una fase por rama**, usa modo plan antes de codificar, y cierra cada fase con `lint + test + build`.

### Fase 0 — Preparación (manual, ~1 h)
- Crear proyecto en Supabase (región São Paulo, la más cercana a Colombia). Authentication → desactivar *Allow new users to sign up* → crear usuarios a mano.
- Repo en GitHub con: `CLAUDE.md`, `ROADMAP.md`, `docs/Tu_Shopper_USA_Contabilidad.xlsx` y la migración en `supabase/migrations/<timestamp>_init.sql` (archivo `0001_init.sql`).
- Instalar Supabase CLI y enlazar el proyecto (`supabase link`). Conectar el repo a Vercel. Variables de entorno: solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

### Fase 1 — Cimientos
**Prompt:**
> Lee CLAUDE.md y ROADMAP.md. Crea el proyecto Vite+React+TS con Tailwind, shadcn/ui, React Router y TanStack Query. Configura el cliente de Supabase, login con email y contraseña (sin registro), rutas protegidas y un layout móvil con navegación inferior: Pedidos, Nuevo (+), Cajas, Inventario, Resumen. Aplica la migración con `supabase db push` y genera los tipos. Escribe un script `scripts/import-inventario.ts` que lea la hoja `Inventario` del xlsx, **normalice los nombres** (trim y espacios dobles), detecte posibles duplicados y los liste antes de insertar, y cree `products` + un `stock_movements` tipo `ingreso` por la cantidad ingresada. Modo plan primero.

**Listo cuando:** puedo entrar con usuario/clave, veo la navegación en el celular y los 101 productos están importados sin duplicados silenciosos.

### Fase 2 — Pedidos (el corazón)
**Prompt:**
> Implementa `src/lib/pricing.ts` (fórmulas de ROADMAP §4) con tests Vitest de los casos A, B y C. Luego la pantalla **Nuevo pedido**: elegir o crear cliente al vuelo (nombre + WhatsApp), agregar líneas con autocompletar de productos (o texto libre), USD, cantidad, TRM (prellenada con la última usada), % (prellenado con el sugerido del producto) y envío cobrado; mostrar costo, precio, ganancia y total **en vivo**. Marca como "incompleta" la línea con costo y sin TRM o %. Luego la lista de Pedidos (filtro por estado de pago y de entrega, búsqueda por cliente) y el detalle del pedido con registro de abonos (varios pagos), cambio de estado de entrega y un botón "Copiar mensaje para WhatsApp" con el resumen y el saldo.

**Listo cuando:** 3 productos de un cliente se registran desde el celular en <1 min y los totales de los casos A–C salen exactos.

### Fase 3 — Cajas de envío
**Prompt:**
> Pantalla Cajas: crear caja (código, courier, fecha de llegada), asignar líneas de pedido a una caja (selección múltiple desde líneas sin caja), y cerrarla escribiendo el costo real. Mostrar por caja: # productos, envío cobrado, costo real, diferencia (ganancia/pérdida) y estado (por cerrar / cerrada) usando `v_shipments`. Alerta de líneas compradas sin caja asignada y de cajas por cerrar. Excluye líneas de pedidos anulados en la vista (hay un TODO en la migración).

**Listo cuando:** la caja de ejemplo del Excel (ENV-001) reproduce la misma diferencia.

### Fase 4 — Inventario
**Prompt:**
> Pantalla Inventario con búsqueda: disponible, ingresado, vendido y estado (disponible/agotado/revisar) desde `v_stock`. Registrar ingreso de stock (producto, cantidad, costo USD opcional, caja opcional) y ajustes. En la línea de pedido, el interruptor "sale del inventario" con selector de producto y aviso si no hay unidades. Listado de "por revisar" (vendido > ingresado).

### Fase 5 — Resumen y salida a producción
**Prompt:**
> Pantalla Resumen que replique la hoja `Resumen` del Excel (lo que cobro, lo que me cuesta, mi ganancia, saldo por cobrar, estados de ventas, cajas, inventario) con filtro por mes. Configura la PWA (instalable, ícono, nombre), botón "Exportar CSV" de pedidos y cajas, y deja el deploy en Vercel funcionando.

**Salida a producción:** usar **app y Excel en paralelo 1–2 semanas** y comparar los totales del Resumen. Cuando coincidan, el Excel se archiva. Antes, decidir lo de respaldos/pausa de Supabase (§3).

### Fase 6 — Mejoras (después del MVP, en este orden)
1. TRM automática del día (con opción de cambiarla a mano).
2. Estado de cuenta por cliente: cuánto debe en total y mensaje de cobro por WhatsApp.
3. Registro de compras al proveedor (tienda, # de orden, tracking) ligado a las líneas.
4. Capas de costo reales (impuestos de EE. UU., envío interno, comisión del medio de pago).
5. Fotos de productos y vista para compartir catálogo por WhatsApp.
6. Reportes: ganancia por mes, productos con mejor margen, clientes frecuentes.

## 6. Propuestas de mejora al flujo

**Alto impacto, bajo esfuerzo (entran al MVP)**
- **Cotización → pedido.** Hoy el Excel arranca cuando ya hay pedido. En la app, la cotización es un pedido en estado `cotizado`; con un botón copia el mensaje listo para WhatsApp y, si el cliente acepta, pasa a `confirmado` sin volver a digitar.
- **Varios abonos por pedido.** El Excel solo guarda un número de abono; la realidad son varios pagos en el tiempo. Con tabla de pagos se ve el historial y el saldo siempre cuadra.
- **Pedido con varias líneas.** Hoy cliente y fecha se repiten por fila; agrupar en un pedido permite ver "lo que debe Juan" de un vistazo.
- **Dos estados separados:** pago (pendiente/separado/pagado) y entrega (cotizado → comprado → en tránsito → en Colombia → entregado). El Excel solo tiene el de pago, y llama "Cancelado" a lo pagado, que confunde con un pedido anulado.
- **Nombres de producto sin errores.** El inventario actual tiene espacios dobles, finales y casi-duplicados (p. ej. "Cremas redondas juicy couture" vs "Cremas  juicy couture"); como el Excel descuenta stock por coincidencia de texto, un error de tipeo rompe el cálculo. En la app se elige el producto de una lista.

**Medio plazo**
- **Valor real vs. valor comercial por capas.** El "costo real" del Excel es solo USD × TRM. El costo verdadero puede incluir impuestos de la tienda en EE. UU., envío interno hasta el casillero, comisión de la tarjeta/medio de pago y flete+aduana de la caja. Si no se registran, la ganancia por producto se ve mejor de lo que es. Validar con ella cuáles aplican.
- **TRM de compra, no de venta.** Lo ideal es guardar la TRM del día en que compró (o la tasa real que le cobró el banco) para no perder margen cuando el dólar se mueve entre cotizar y pagar.
- **Precio sugerido por categoría y margen mínimo.** Un % por defecto por categoría y una alerta si el margen queda por debajo de un mínimo.
- **Envío vs. gestión.** Hoy ambos viven en "Envío cobrado". Separarlos permite saber cuánto gana por producto, por transporte y por gestión (los productos sin costo viven de la gestión).
- **Ganancia neta por producto.** Hoy la ganancia de envío es por caja. Opcionalmente repartir el costo real entre productos por peso o valor.
- **Inventario con costo.** Guardar costo de lo que queda en stock para saber cuánta plata tiene parada; separar "stock para vender" de "pedido por encargo".

## 7. Preguntas para validar con ella antes de la Fase 2
1. ¿El envío/gestión lo cobra **por producto** o **por pedido**? (el esquema lo guarda por línea como el Excel; si es por pedido, ajustamos).
2. ¿Paga impuestos de la tienda o envío interno en EE. UU. al comprar? ¿Cómo se factura la caja (por libra, por volumen, por valor)?
3. ¿Trae productos de más "para vender" o solo compra lo que piden? (define qué tan importante es el inventario).
4. ¿Quién más va a usar la app además de ella?
5. ¿Cuántos pedidos y cajas por mes aproximadamente? (confirma que el plan gratis de Supabase alcanza en tamaño).

## 8. Riesgos y notas
- La migración usa `security_invoker = true` en las vistas (Postgres 15+, es lo que usa Supabase) para que RLS se aplique también a ellas.
- Las tablas están pensadas para un solo dueño; si más adelante hay empleados con roles distintos, se ajustan las políticas RLS.
- La API de la TRM (datos abiertos de la Superfinanciera en datos.gov.co) debe verificarse al implementarla; si hay problema de CORS desde el navegador, usar una Edge Function.
- Fuera de alcance por ahora: facturación electrónica y contabilidad tributaria. Esta app es control operativo, no reemplaza a un contador.

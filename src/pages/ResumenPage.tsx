import { useSearchParams } from 'react-router'
import { useCashFlow } from '@/api/cash'
import { useOrders } from '@/api/orders'
import { useShipments, useUnboxedItems } from '@/api/shipments'
import { useStock } from '@/api/stock'
import { ExportButtons } from '@/components/summary/ExportButtons'
import { BoxesCard, ShippingProfitCard } from '@/components/summary/ShippingSummary'
import { SummaryCard, SummaryRow } from '@/components/summary/SummaryCard'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { buildCashFlow } from '@/lib/cash-flow'
import { errorMessage } from '@/lib/errors'
import { formatMonth, todayBogota } from '@/lib/format'
import { buildSummary, monthOptions } from '@/lib/summary'

const ALL_MONTHS = 'todos'

/** La hoja "Resumen" del Excel, por mes. */
export function ResumenPage() {
  const orders = useOrders()
  const shipments = useShipments()
  const unboxed = useUnboxedItems()
  const stock = useStock()
  const cash = useCashFlow()
  const [params, setParams] = useSearchParams()

  const queries = [orders, shipments, unboxed, stock, cash]
  const failed = queries.find((q) => q.isError)
  if (failed) {
    return (
      <div className="grid gap-3 py-8 text-center">
        <p className="text-destructive">No se pudo calcular el resumen: {errorMessage(failed.error)}</p>
        <Button variant="outline" onClick={() => queries.forEach((q) => void q.refetch())}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!orders.data || !shipments.data || !unboxed.data || !stock.data || !cash.data) {
    return <p className="py-8 text-center text-muted-foreground">Calculando resumen…</p>
  }

  const today = todayBogota()
  const monthParam = params.get('mes')
  const month =
    monthParam === ALL_MONTHS ? null : monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7)
  const options = monthOptions(orders.data, shipments.data, today, cash.data)
  const s = buildSummary(
    { orders: orders.data, shipments: shipments.data, unboxed: unboxed.data, stock: stock.data },
    month,
  )
  const flow = buildCashFlow(cash.data, month, today)
  const dineroLink =
    month === null ? '/dinero?mes=todos' : month === today.slice(0, 7) ? '/dinero' : `/dinero?mes=${month}`

  return (
    <div className="grid gap-3">
      <NativeSelect
        aria-label="Mes"
        containerClassName="w-full"
        className="h-11 text-base capitalize"
        value={month ?? ALL_MONTHS}
        onChange={(event) =>
          setParams(event.target.value === today.slice(0, 7) ? {} : { mes: event.target.value }, { replace: true })
        }
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {formatMonth(option)}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={ALL_MONTHS}>Todos los meses</NativeSelectOption>
      </NativeSelect>

      <SummaryCard title="Lo que cobro">
        <SummaryRow label="Productos (sin el envío)" value={s.billing.productsCop} />
        <SummaryRow label="Envío cobrado (incluido en los precios)" value={s.billing.shippingCop} />
        <SummaryRow label="Total facturado" value={s.billing.totalCop} strong />
        <SummaryRow label="Abonos y pagos recibidos" value={s.billing.paidCop} />
        <SummaryRow label="Saldo por cobrar" value={s.billing.balanceCop} strong to="/pedidos" />
      </SummaryCard>

      <SummaryCard title="Lo que me cuesta">
        <SummaryRow label="Productos (USD × TRM)" value={s.costs.productsCop} />
        <SummaryRow label="Envío pagado en cajas" value={s.costs.shippingCostCop} />
      </SummaryCard>

      <SummaryCard title="Mi ganancia">
        <SummaryRow label="Ganancia de los productos" value={s.profit.productsCop} signed />
        <SummaryRow label="Ganancia de los envíos" value={s.profit.shippingCop} signed />
        <SummaryRow label="Ganancia total" value={s.profit.totalCop} strong signed />
      </SummaryCard>

      <ShippingProfitCard shipping={s.shipping} />

      <SummaryCard title="Flujo de caja" note="por fecha del movimiento">
        <SummaryRow label="Entró (abonos y plata que metí)" value={flow.inCop} />
        <SummaryRow label="Salió" value={flow.outCop} />
        <SummaryRow label="Reinvertido (compras)" value={flow.bySource.reinversion} />
        <SummaryRow label="Saqué para mí" value={flow.bySource.retiro} />
        <SummaryRow
          label={flow.closedMonth ? 'Saldo al cierre del mes' : 'Plata del negocio hoy'}
          value={flow.balanceCop}
          strong
          signed
          to={dineroLink}
        />
      </SummaryCard>

      <SummaryCard title="Estado de las ventas" note="pedidos">
        <SummaryRow label="Pendientes (sin abono)" value={s.sales.pendiente} kind="count" to="/pedidos?pago=pendiente" />
        <SummaryRow
          label="Separados (con abono, deben saldo)"
          value={s.sales.separado}
          kind="count"
          to="/pedidos?pago=separado"
        />
        <SummaryRow label="Pagados (completos)" value={s.sales.pagado} kind="count" to="/pedidos?pago=pagado" />
        <SummaryRow label="Con datos por completar (TRM o %)" value={s.sales.incomplete} kind="count" />
        <SummaryRow
          label="Cotizaciones (no cuentan en los totales)"
          value={s.sales.quotes}
          kind="count"
          to="/pedidos?entrega=cotizado"
        />
      </SummaryCard>

      <BoxesCard shipments={s.shipments} month={month} />

      <SummaryCard title="Inventario" note="hoy">
        <SummaryRow label="Productos registrados" value={s.stock.products} kind="count" to="/inventario" />
        <SummaryRow label="Unidades disponibles" value={s.stock.availableUnits} kind="count" />
        <SummaryRow
          label="Unidades en camino"
          value={s.stock.inTransitUnits}
          kind="count"
          to="/inventario?estado=en_camino"
        />
        <SummaryRow
          label="Productos agotados"
          value={s.stock.soldOut}
          kind="count"
          to="/inventario?estado=agotado"
        />
        <SummaryRow
          label="Productos por revisar (vendido > ingresado)"
          value={s.stock.toReview}
          kind="count"
          to="/inventario?estado=revisar"
        />
      </SummaryCard>

      <ExportButtons month={month} orders={orders.data} shipments={shipments.data} cash={cash.data} />
    </div>
  )
}

import { Link } from 'react-router'
import type { Shipment } from '@/api/shipments'
import { DifferenceValue } from '@/components/shipments/ShipmentCard'
import { SummaryGroup, SummaryRow } from '@/components/summary/SummaryCard'
import { formatCop, formatMonth, formatSignedCop as signedCop } from '@/lib/format'
import type { Summary } from '@/lib/summary'
import { cn } from '@/lib/utils'

/** Lo más importante del Resumen: la ganancia del mes, separada en productos y envíos. */
export function ProfitHero({ summary, month }: { summary: Summary; month: string | null }) {
  const { profit, shipping } = summary
  const stockPending = shipping.stockEstimatedCop === null && shipping.stockChargedCop > 0
  const shippingNote = [
    `Cajas ${signedCop(shipping.boxesProfitCop)}`,
    stockPending
      ? 'Inventario sin estimar'
      : shipping.stockUnits > 0 && `Inventario ≈ ${signedCop(shipping.stockProfitCop)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="grid gap-3 rounded-lg bg-primary p-4 text-primary-foreground">
      <div>
        <p className="text-sm opacity-80">Mi ganancia {month ? `de ${formatMonth(month)}` : 'de todos los meses'}</p>
        <p className={cn('text-3xl font-semibold tabular-nums', profit.totalCop < 0 && 'text-red-300')}>
          {formatCop(profit.totalCop)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <HeroTile label="Productos" value={profit.productsCop} />
        <HeroTile label="Envíos" value={profit.shippingCop} note={shippingNote} />
      </div>
    </section>
  )
}

function HeroTile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-md bg-white/10 p-3">
      <p className="text-xs opacity-80">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums', value < 0 && 'text-red-300')}>{formatCop(value)}</p>
      {note && <p className="text-xs opacity-80">{note}</p>}
    </div>
  )
}

/**
 * Cómo sale la ganancia de envíos: pedidos en cajas (cobrado vs. lo que les tocó) y ventas del
 * inventario (cobrado vs. el promedio de las cajas, estimado). Va dentro de una SummarySection.
 */
export function ShippingDetailRows({ shipping }: { shipping: Summary['shipping'] }) {
  const pending = shipping.unboxedCop + shipping.uncomparedBoxesCop

  return (
    <>
      <SummaryGroup>Pedidos que llegaron en cajas</SummaryGroup>
      <SummaryRow label="Envío cobrado" value={shipping.boxesChargedCop} />
      <SummaryRow label="Lo que les tocó de las cajas" value={shipping.boxesRealCop} />
      <SummaryRow label="Ganancia" value={shipping.boxesProfitCop} strong signed />

      <SummaryGroup>Ventas del inventario (estimado)</SummaryGroup>
      <SummaryRow label="Envío cobrado" value={shipping.stockChargedCop} />
      {shipping.stockEstimatedCop === null ? (
        <div className="text-xs text-muted-foreground">
          Aún no hay cajas con número de productos para sacar el promedio.
        </div>
      ) : (
        <>
          <SummaryRow label={estimatedLabel(shipping)} value={shipping.stockEstimatedCop} />
          <SummaryRow label="Ganancia estimada" value={shipping.stockProfitCop} strong signed />
        </>
      )}

      {pending > 0 && (
        <>
          <SummaryGroup>Por comparar</SummaryGroup>
          {shipping.unboxedCop > 0 && (
            <SummaryRow label="Pedidos que aún no tienen caja" value={shipping.unboxedCop} to="/cajas" />
          )}
          {shipping.uncomparedBoxesCop > 0 && (
            <SummaryRow label="En cajas sin costo o sin productos" value={shipping.uncomparedBoxesCop} to="/cajas" />
          )}
        </>
      )}

      <div className="pt-1 text-xs text-muted-foreground">
        Cada caja se divide entre los productos que trae. El inventario se compara con el promedio por producto de
        las cajas.
      </div>
    </>
  )
}

/** "Envío estimado (1 con su caja + 2 × 4.163 promedio)": de dónde sale el estimado del inventario. */
function estimatedLabel(shipping: Summary['shipping']): string {
  const withAverage = shipping.stockUnits - shipping.stockBoxedUnits
  const parts = [
    shipping.stockBoxedUnits > 0 && `${shipping.stockBoxedUnits} con su caja`,
    withAverage > 0 && `${withAverage} × ${formatCop(shipping.avgCostPerUnitCop ?? 0)} promedio`,
  ].filter(Boolean)
  return parts.length > 0 ? `Envío estimado (${parts.join(' + ')})` : 'Envío estimado'
}

/** Las cajas del periodo con su comparativa, y cuántas llegaron o siguen en camino. */
export function BoxesRows({ shipments, month }: { shipments: Summary['shipments']; month: string | null }) {
  return (
    <>
      {shipments.boxes.length === 0 ? (
        <div className="text-muted-foreground">No hay cajas {month ? 'en este mes' : 'todavía'}.</div>
      ) : (
        <div className="grid gap-1.5">
          {shipments.boxes.map((box) => (
            <BoxRow key={box.id} box={box} />
          ))}
        </div>
      )}
      <SummaryRow label="Llegaron" value={shipments.arrived} kind="count" to="/cajas" />
      <SummaryRow label="En camino" value={shipments.inTransit} kind="count" to="/cajas" />
      {shipments.withoutCost > 0 && (
        <SummaryRow label="Sin costo de envío" value={shipments.withoutCost} kind="count" to="/cajas" />
      )}
      {shipments.withoutProducts > 0 && (
        <SummaryRow label="Con costo pero sin productos" value={shipments.withoutProducts} kind="count" to="/cajas" />
      )}
    </>
  )
}

function BoxRow({ box }: { box: Shipment }) {
  const detail =
    box.differenceCop !== null
      ? [
          `${box.unitsTotal} productos`,
          `${formatCop(box.costPerUnitCop ?? 0)} c/u`,
          `cobrado ${formatCop(box.chargedCop)}`,
          `les tocó ${formatCop(box.clientsRealCop ?? 0)}`,
        ].join(' · ')
      : box.realCostCop === null
        ? 'Sin costo de envío todavía'
        : 'Sin productos: escribe cuántos trae'

  return (
    <Link to={`/cajas/${box.id}`} className="grid gap-0.5 rounded-sm border-b pb-1.5 hover:bg-muted/50">
      <span className="flex items-center justify-between gap-3">
        <span className="font-medium">{box.code}</span>
        <DifferenceValue value={box.differenceCop} className="shrink-0 text-sm" />
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </Link>
  )
}


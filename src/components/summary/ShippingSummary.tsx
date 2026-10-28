import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Shipment } from '@/api/shipments'
import { DifferenceValue } from '@/components/shipments/ShipmentCard'
import { SummaryCard, SummaryRow } from '@/components/summary/SummaryCard'
import { formatCop } from '@/lib/format'
import type { Summary } from '@/lib/summary'

/** Subtítulo dentro de una tarjeta del Resumen. */
function SummaryGroup({ children }: { children: ReactNode }) {
  return <div className="pt-2 text-xs font-medium text-muted-foreground first:pt-0">{children}</div>
}

/**
 * La comparativa de envíos: lo que se cobró de envío a los pedidos contra lo que les tocó de
 * las cajas. El inventario y lo que aún no se puede comparar van aparte.
 */
export function ShippingProfitCard({ shipping }: { shipping: Summary['shipping'] }) {
  const inventory = shipping.inventoryShareCop + shipping.stockSalesCop
  const pending = shipping.unboxedCop + shipping.uncomparedBoxesCop

  return (
    <SummaryCard title="Ganancia de envíos" note="cobrado vs. lo que costó">
      <SummaryGroup>Pedidos en cajas con costo</SummaryGroup>
      <SummaryRow label="Envío cobrado (estimado)" value={shipping.chargedCop} />
      <SummaryRow label="Lo que les tocó de las cajas" value={shipping.realCop} />
      <SummaryRow label="Ganancia de envíos" value={shipping.profitCop} strong signed />

      {inventory > 0 && (
        <>
          <SummaryGroup>Inventario · no se compara por ahora</SummaryGroup>
          <SummaryRow label="Parte de inventario en las cajas" value={shipping.inventoryShareCop} />
          <SummaryRow label="Envío cobrado en ventas del inventario" value={shipping.stockSalesCop} />
        </>
      )}

      {pending > 0 && (
        <>
          <SummaryGroup>Por comparar</SummaryGroup>
          {shipping.unboxedCop > 0 && (
            <SummaryRow label="Envío cobrado de pedidos sin caja" value={shipping.unboxedCop} to="/cajas" />
          )}
          {shipping.uncomparedBoxesCop > 0 && (
            <SummaryRow label="En cajas sin costo o sin productos" value={shipping.uncomparedBoxesCop} to="/cajas" />
          )}
        </>
      )}

      <div className="pt-1 text-xs text-muted-foreground">
        El costo de cada caja se divide entre los productos que trae; a cada pedido se le compara el envío que
        cobraste con lo que le tocó.
      </div>
    </SummaryCard>
  )
}

/** Las cajas del mes, cada una con su comparativa, y cuántas llegaron o siguen en camino. */
export function BoxesCard({ shipments, month }: { shipments: Summary['shipments']; month: string | null }) {
  return (
    <SummaryCard title={month ? 'Cajas del mes' : 'Cajas'}>
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
    </SummaryCard>
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

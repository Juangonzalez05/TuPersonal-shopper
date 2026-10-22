import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Shipment } from '@/api/shipments'
import { Badge } from '@/components/ui/badge'
import { formatCop } from '@/lib/format'
import { shipmentStateClass, shipmentStateLabel, shipmentSubtitle, type ShipmentState } from '@/lib/shipments'
import { cn } from '@/lib/utils'

export function ShipmentStateBadge({ state }: { state: ShipmentState }) {
  return <Badge className={shipmentStateClass[state]}>{shipmentStateLabel[state]}</Badge>
}

/** Diferencia de la caja: ganancia en verde, pérdida en rojo, "—" si está por cerrar. */
export function DifferenceValue({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className={cn('text-muted-foreground', className)}>—</span>
  return (
    <span className={cn('tabular-nums', value < 0 ? 'text-red-700' : 'text-emerald-700', className)}>
      {value < 0 ? `Pérdida ${formatCop(-value)}` : `Ganancia ${formatCop(value)}`}
    </span>
  )
}

export function ShipmentCard({ shipment }: { shipment: Shipment }) {
  return (
    <Link
      to={`/cajas/${shipment.id}`}
      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{shipment.code}</p>
          <p className="truncate text-xs text-muted-foreground">{shipmentSubtitle(shipment)}</p>
        </div>
        <ShipmentStateBadge state={shipment.state} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <Stat label="Productos">{shipment.itemsCount}</Stat>
        <Stat label="Envío cobrado">{formatCop(shipment.chargedCop)}</Stat>
        <Stat label="Costo real">{shipment.realCostCop === null ? '—' : formatCop(shipment.realCostCop)}</Stat>
        <Stat label="Diferencia">
          <DifferenceValue value={shipment.differenceCop} />
        </Stat>
      </dl>
    </Link>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{children}</dd>
    </div>
  )
}

import { PackagePlus, Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  useDeleteShipment,
  useShipment,
  useShipments,
  useUnassignItem,
  useUpdateShipment,
  type ShipmentDetail,
} from '@/api/shipments'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CloseShipmentForm } from '@/components/shipments/CloseShipmentForm'
import { DifferenceValue, ShipmentStateBadge } from '@/components/shipments/ShipmentCard'
import { ShipmentForm } from '@/components/shipments/ShipmentForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errorMessage, isUniqueViolation } from '@/lib/errors'
import { formatCop } from '@/lib/format'
import { shipmentFields, shipmentSubtitle } from '@/lib/shipments'
import { cn } from '@/lib/utils'

export function CajaDetallePage() {
  const { shipmentId = '' } = useParams()
  const shipment = useShipment(shipmentId)

  if (shipment.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando caja…</p>
  if (shipment.isError) {
    return <p className="py-8 text-center text-destructive">No se pudo cargar: {errorMessage(shipment.error)}</p>
  }
  if (!shipment.data) return <p className="py-8 text-center text-muted-foreground">Esta caja no existe.</p>

  return <ShipmentView shipment={shipment.data} />
}

function ShipmentView({ shipment }: { shipment: ShipmentDetail }) {
  const navigate = useNavigate()
  const allShipments = useShipments()
  const updateShipment = useUpdateShipment(shipment.id)
  const deleteShipment = useDeleteShipment()
  const unassignItem = useUnassignItem()
  const [editing, setEditing] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const carriers = [
    ...new Set((allShipments.data ?? []).map((s) => s.carrier).filter((c): c is string => Boolean(c))),
  ]

  const reopen = async () => {
    try {
      await updateShipment.mutateAsync({ realCostCop: null })
      toast.success('Caja reabierta: queda por cerrar')
    } catch (error) {
      toast.error(`No se pudo reabrir: ${errorMessage(error)}`)
    }
  }

  const remove = async () => {
    try {
      await deleteShipment.mutateAsync(shipment.id)
      toast.success(`Caja ${shipment.code} borrada`)
      navigate('/cajas', { replace: true })
    } catch (error) {
      toast.error(`No se pudo borrar: ${errorMessage(error)}`)
    }
  }

  const unassign = async (itemId: string, description: string) => {
    try {
      await unassignItem.mutateAsync(itemId)
      toast.success(`${description} quedó sin caja`)
    } catch (error) {
      toast.error(`No se pudo quitar: ${errorMessage(error)}`)
    }
  }

  return (
    <div className="grid gap-5">
      {editing ? (
        <ShipmentForm
          defaultValues={{
            code: shipment.code,
            carrier: shipment.carrier ?? '',
            arrivedOn: shipment.arrivedOn ?? '',
            notes: shipment.notes ?? '',
          }}
          carriers={carriers}
          submitLabel="Guardar"
          pending={updateShipment.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            try {
              await updateShipment.mutateAsync(shipmentFields(values))
              toast.success('Caja actualizada')
              setEditing(false)
            } catch (error) {
              toast.error(
                isUniqueViolation(error)
                  ? 'Ya existe una caja con ese código.'
                  : `No se pudo guardar: ${errorMessage(error)}`,
              )
            }
          }}
        />
      ) : (
        <section className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{shipment.code}</h2>
              <ShipmentStateBadge state={shipment.state} />
            </div>
            <p className="text-sm text-muted-foreground">{shipmentSubtitle(shipment)}</p>
            {shipment.notes && <p className="mt-1 text-sm">{shipment.notes}</p>}
          </div>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setEditing(true)}>
            <Pencil />
            Editar
          </Button>
        </section>
      )}

      <section>
        <dl className="grid gap-1.5 rounded-lg border p-3 text-sm">
          <Row label="Productos">{shipment.itemsCount}</Row>
          <Row label="Envío cobrado a clientes">{formatCop(shipment.chargedCop)}</Row>
          <Row label="Costo real">{shipment.realCostCop === null ? '—' : formatCop(shipment.realCostCop)}</Row>
          <div className="my-1 border-t" />
          <Row label="Diferencia" strong>
            <DifferenceValue value={shipment.differenceCop} />
          </Row>
        </dl>
      </section>

      {shipment.state === 'por_cerrar' ? (
        <CloseShipmentForm shipmentId={shipment.id} arrivedOn={shipment.arrivedOn} chargedCop={shipment.chargedCop} />
      ) : (
        <Button variant="outline" className="h-11" onClick={() => setConfirmReopen(true)}>
          Reabrir caja
        </Button>
      )}

      <section className="grid gap-2">
        <h3 className="font-semibold">Productos en la caja</h3>
        {shipment.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta caja está vacía.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shipment.items.map((item) => {
              const cancelled = item.orderStatus === 'anulado'
              return (
                <li key={item.id} className={cn('flex items-center gap-2 p-3', cancelled && 'opacity-60')}>
                  <Link to={`/pedidos/${item.orderId}`} className="min-w-0 flex-1">
                    <p className={cn('truncate font-medium', cancelled && 'line-through')}>
                      {item.qty} × {item.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.customerName} · envío {formatCop(item.shippingChargedCop)}
                    </p>
                    {cancelled && <Badge className="mt-1 bg-red-100 text-red-900">Anulado · no cuenta</Badge>}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-muted-foreground"
                    aria-label={`Quitar ${item.description} de la caja`}
                    disabled={unassignItem.isPending}
                    onClick={() => void unassign(item.id, item.description)}
                  >
                    <X className="size-5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        <Button asChild variant="outline" className="h-11">
          <Link to={`/cajas/${shipment.id}/agregar`}>
            <PackagePlus />
            Agregar productos
          </Link>
        </Button>
      </section>

      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setConfirmDelete(true)}>
        Borrar caja
      </Button>

      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="¿Reabrir la caja?"
        description="Se borra el costo real y la caja vuelve a quedar por cerrar."
        confirmLabel="Reabrir"
        onConfirm={() => void reopen()}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Borrar la caja ${shipment.code}?`}
        description="Sus productos no se borran: quedan sin caja y puedes asignarlos a otra."
        confirmLabel="Borrar caja"
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  )
}

function Row({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'text-base font-semibold')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}

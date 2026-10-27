import { PackageCheck, PackagePlus, Pencil, Plus, X } from 'lucide-react'
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
import { useDeleteMovement } from '@/api/stock'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { StockMovementForm } from '@/components/stock/StockMovementForm'
import { DifferenceValue, ShipmentStateBadge } from '@/components/shipments/ShipmentCard'
import { ShipmentForm } from '@/components/shipments/ShipmentForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage, isUniqueViolation } from '@/lib/errors'
import { formatCop, formatDate, formatUsd, todayBogota } from '@/lib/format'
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
  const deleteMovement = useDeleteMovement()
  const [editing, setEditing] = useState(false)
  const [addingStock, setAddingStock] = useState(false)
  const [arrivalDate, setArrivalDate] = useState(todayBogota())
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const carriers = [
    ...new Set((allShipments.data ?? []).map((s) => s.carrier).filter((c): c is string => Boolean(c))),
  ]

  const setArrival = async (arrivedOn: string | null) => {
    try {
      await updateShipment.mutateAsync({ arrivedOn })
      toast.success(
        arrivedOn ? 'Caja marcada como llegada: su inventario ya está disponible' : 'La caja vuelve a estar en camino',
      )
    } catch (error) {
      toast.error(`No se pudo guardar: ${errorMessage(error)}`)
    }
  }

  const removeStock = async (movementId: string, name: string) => {
    try {
      await deleteMovement.mutateAsync(movementId)
      toast.success(`${name} se quitó de la caja y del inventario`)
    } catch (error) {
      toast.error(`No se pudo quitar: ${errorMessage(error)}`)
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
            shippedOn: shipment.shippedOn ?? '',
            expectedOn: shipment.expectedOn ?? '',
            realCost: shipment.realCostCop === null ? '' : String(shipment.realCostCop),
            notes: shipment.notes ?? '',
          }}
          carriers={carriers}
          withStock={false}
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
          <Row label="Productos de clientes">{shipment.itemsCount}</Row>
          <Row label="Unidades para inventario">{shipment.stockUnits}</Row>
          <Row label="Envío cobrado a clientes">{formatCop(shipment.chargedCop)}</Row>
          <Row label="Costo del envío">
            {shipment.realCostCop === null ? (
              <button type="button" className="text-primary underline" onClick={() => setEditing(true)}>
                Escribirlo
              </button>
            ) : (
              formatCop(shipment.realCostCop)
            )}
          </Row>
          <div className="my-1 border-t" />
          <Row label="Ganancia de envío" strong>
            <DifferenceValue value={shipment.differenceCop} />
          </Row>
        </dl>
        <p className="mt-1 text-xs text-muted-foreground">
          Ganancia de envío = lo que cobraste de envío a los clientes de esta caja − el costo del envío.
        </p>
      </section>

      {shipment.state === 'en_camino' ? (
        <section className="grid gap-2 rounded-lg border p-3">
          <h3 className="font-medium">¿Ya llegó?</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              aria-label="Fecha de llegada"
              className="h-11 text-base"
              value={arrivalDate}
              onChange={(event) => setArrivalDate(event.target.value)}
            />
            <Button
              className="h-11"
              disabled={updateShipment.isPending || !arrivalDate}
              onClick={() => void setArrival(arrivalDate)}
            >
              <PackageCheck />
              Marcar llegada
            </Button>
          </div>
          {shipment.stockUnits > 0 && (
            <p className="text-xs text-muted-foreground">
              Al marcarla, sus {shipment.stockUnits} unidades pasan a disponibles en el inventario.
            </p>
          )}
        </section>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <p className="text-sm">Llegó el {formatDate(shipment.arrivedOn ?? '')}</p>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setConfirmReopen(true)}>
            Deshacer llegada
          </Button>
        </div>
      )}

      <section className="grid gap-2">
        <h3 className="font-semibold">Inventario que trae</h3>
        {shipment.stock.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trae productos para el inventario.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {shipment.stock.map((item) => (
              <li key={item.movementId} className="flex items-center gap-2 p-3">
                <Link to={`/inventario/${item.productId}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {item.qty} × {item.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shipment.state === 'en_camino' ? 'En camino' : 'Ya en el inventario'}
                    {item.unitCostUsd !== null && ` · ${formatUsd(item.unitCostUsd)} c/u`}
                  </p>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label={`Quitar ${item.productName} de la caja`}
                  disabled={deleteMovement.isPending}
                  onClick={() => void removeStock(item.movementId, item.productName)}
                >
                  <X className="size-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {addingStock ? (
          <StockMovementForm
            kind="ingreso"
            shipment={{ id: shipment.id, code: shipment.code }}
            onDone={() => setAddingStock(false)}
          />
        ) : (
          <Button variant="outline" className="h-11" onClick={() => setAddingStock(true)}>
            <Plus />
            Agregar producto al inventario de la caja
          </Button>
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="font-semibold">Productos de pedidos de clientes</h3>
        {shipment.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tiene productos de pedidos. Agrégalos para que su envío cobrado cuente en la ganancia.
          </p>
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
            Agregar productos de pedidos
          </Link>
        </Button>
      </section>

      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setConfirmDelete(true)}>
        Borrar caja
      </Button>

      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="¿Deshacer la llegada?"
        description="La caja vuelve a estar en camino y su inventario deja de contar como disponible."
        confirmLabel="Deshacer llegada"
        onConfirm={() => void setArrival(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Borrar la caja ${shipment.code}?`}
        description="Los productos de pedidos quedan sin caja (puedes asignarlos a otra) y el inventario que traía se quita."
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

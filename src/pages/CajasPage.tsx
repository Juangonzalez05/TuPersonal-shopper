import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCreateShipment, useShipments, useUnboxedItems } from '@/api/shipments'
import { ShipmentAlerts } from '@/components/shipments/ShipmentAlerts'
import { ShipmentCard } from '@/components/shipments/ShipmentCard'
import { ShipmentForm } from '@/components/shipments/ShipmentForm'
import { Button } from '@/components/ui/button'
import { errorMessage, isUniqueViolation } from '@/lib/errors'
import { isPurchasedStatus } from '@/lib/order-labels'
import { nextShipmentCode, shipmentFields } from '@/lib/shipments'

export function CajasPage() {
  const navigate = useNavigate()
  const shipments = useShipments()
  const unboxed = useUnboxedItems()
  const createShipment = useCreateShipment()
  const [creating, setCreating] = useState(false)

  if (shipments.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando cajas…</p>
  if (shipments.isError) {
    return (
      <div className="grid gap-3 py-8 text-center">
        <p className="text-destructive">No se pudieron cargar las cajas: {errorMessage(shipments.error)}</p>
        <Button variant="outline" onClick={() => shipments.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const list = shipments.data
  const carriers = [...new Set(list.map((s) => s.carrier).filter((c): c is string => Boolean(c)))]
  const unboxedPurchased = (unboxed.data ?? []).filter((item) => isPurchasedStatus(item.orderStatus))
  const openCount = list.filter((s) => s.state === 'por_cerrar').length

  return (
    <div className="grid gap-3">
      <ShipmentAlerts unboxedPurchased={unboxedPurchased} openCount={openCount} />

      {creating ? (
        <ShipmentForm
          defaultValues={{ code: nextShipmentCode(list.map((s) => s.code)), carrier: '', arrivedOn: '', notes: '' }}
          carriers={carriers}
          submitLabel="Crear caja"
          pending={createShipment.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            try {
              const id = await createShipment.mutateAsync(shipmentFields(values))
              toast.success(`Caja ${shipmentFields(values).code} creada`)
              navigate(`/cajas/${id}`)
            } catch (error) {
              toast.error(
                isUniqueViolation(error)
                  ? 'Ya existe una caja con ese código.'
                  : `No se pudo crear la caja: ${errorMessage(error)}`,
              )
            }
          }}
        />
      ) : (
        <Button size="lg" className="h-12 text-base" onClick={() => setCreating(true)}>
          <Plus />
          Nueva caja
        </Button>
      )}

      {list.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Aún no hay cajas. Crea una cuando juntes productos para enviar.
        </p>
      ) : (
        <ul className="grid gap-2">
          {list.map((shipment) => (
            <li key={shipment.id}>
              <ShipmentCard shipment={shipment} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

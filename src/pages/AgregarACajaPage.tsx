import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAssignItems, useShipment, useUnboxedItems, type BoxItem } from '@/api/shipments'
import { DeliveryBadge } from '@/components/orders/StatusBadges'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/errors'
import { formatCop, formatDate } from '@/lib/format'
import { matchesQuery } from '@/lib/search'

/** Elegir varias líneas sin caja y meterlas en esta caja. */
export function AgregarACajaPage() {
  const { shipmentId = '' } = useParams()
  const navigate = useNavigate()
  const shipment = useShipment(shipmentId)
  const unboxed = useUnboxedItems()
  const assignItems = useAssignItems(shipmentId)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (shipment.isPending || unboxed.isPending) {
    return <p className="py-8 text-center text-muted-foreground">Cargando productos…</p>
  }
  if (shipment.isError || unboxed.isError) {
    return (
      <p className="py-8 text-center text-destructive">
        No se pudo cargar: {errorMessage(shipment.error ?? unboxed.error)}
      </p>
    )
  }
  if (!shipment.data) return <p className="py-8 text-center text-muted-foreground">Esta caja no existe.</p>

  const code = shipment.data.code
  const visible = unboxed.data.filter((item) => matchesQuery(`${item.customerName} ${item.description}`, query))
  const byCustomer = new Map<string, BoxItem[]>()
  for (const item of visible) byCustomer.set(item.customerName, [...(byCustomer.get(item.customerName) ?? []), item])
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.id))

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleVisible = () => {
    setSelected((current) => {
      const next = new Set(current)
      for (const item of visible) {
        if (allVisibleSelected) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })
  }

  const save = async () => {
    try {
      await assignItems.mutateAsync([...selected])
      toast.success(
        selected.size === 1 ? `1 producto agregado a ${code}` : `${selected.size} productos agregados a ${code}`,
      )
      navigate(`/cajas/${shipmentId}`, { replace: true })
    } catch (error) {
      toast.error(`No se pudieron agregar: ${errorMessage(error)}`)
    }
  }

  if (unboxed.data.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No hay productos pendientes de caja. Aquí aparecen las líneas de pedidos confirmados o comprados que aún
        no están en ninguna caja.
      </p>
    )
  }

  return (
    <div className="grid gap-3 pb-20">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar cliente o producto"
          aria-label="Buscar cliente o producto"
          className="h-11 pl-9 text-base"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {visible.length === 1 ? '1 producto sin caja' : `${visible.length} productos sin caja`}
        </p>
        {visible.length > 0 && (
          <Button variant="link" className="h-auto p-0" onClick={toggleVisible}>
            {allVisibleSelected ? 'Quitar selección' : 'Seleccionar todos'}
          </Button>
        )}
      </div>

      {[...byCustomer].map(([customerName, items]) => (
        <section key={customerName} className="grid gap-1">
          <h3 className="text-sm font-semibold">{customerName}</h3>
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 p-3">
                  <Checkbox
                    className="size-5"
                    checked={selected.has(item.id)}
                    onCheckedChange={(checked) => toggle(item.id, checked === true)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.qty} × {item.description}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Pedido {formatDate(item.orderedOn)} · envío {formatCop(item.shippingChargedCop)}
                    </span>
                  </span>
                  <DeliveryBadge status={item.orderStatus} />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
          <p className="flex-1 text-sm text-muted-foreground">
            {selected.size === 1 ? '1 seleccionado' : `${selected.size} seleccionados`}
          </p>
          <Button
            size="lg"
            className="h-12 px-5 text-base"
            disabled={selected.size === 0 || assignItems.isPending}
            onClick={() => void save()}
          >
            {assignItems.isPending ? 'Agregando…' : `Agregar a ${code}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

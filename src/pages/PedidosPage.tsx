import { Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useOrders } from '@/api/orders'
import { OrderCard } from '@/components/orders/OrderCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/errors'
import { formatCop } from '@/lib/format'
import {
  DELIVERY_STATUSES,
  deliveryStatusLabel,
  isDeliveryStatus,
  isPaymentStatus,
  PAYMENT_STATUSES,
  paymentStatusLabel,
} from '@/lib/order-labels'
import { matchesQuery } from '@/lib/search'
import { cn } from '@/lib/utils'

// Los filtros viven en la URL para que se mantengan al volver del detalle.
const ALL = 'todos'
const NOT_CANCELLED = 'activos'

export function PedidosPage() {
  const orders = useOrders()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const paymentParam = params.get('pago')
  const payment = isPaymentStatus(paymentParam) ? paymentParam : ALL
  const deliveryParam = params.get('entrega')
  const delivery = deliveryParam === ALL || isDeliveryStatus(deliveryParam) ? deliveryParam : NOT_CANCELLED

  const setParam = (key: string, value: string, defaultValue: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === defaultValue) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  if (orders.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando pedidos…</p>
  if (orders.isError) {
    return (
      <div className="grid gap-3 py-8 text-center">
        <p className="text-destructive">No se pudieron cargar los pedidos: {errorMessage(orders.error)}</p>
        <Button variant="outline" onClick={() => orders.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (orders.data.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 py-12 text-center">
        <p className="text-muted-foreground">Aún no hay pedidos.</p>
        <Button asChild size="lg" className="h-12">
          <Link to="/pedidos/nuevo">
            <Plus />
            Nuevo pedido
          </Link>
        </Button>
      </div>
    )
  }

  const visible = orders.data.filter(
    (order) =>
      matchesQuery(`${order.customerName} ${order.customerPhone ?? ''}`, query) &&
      (payment === ALL || order.paymentStatus === payment) &&
      (delivery === ALL ||
        (delivery === NOT_CANCELLED ? order.status !== 'anulado' : order.status === delivery)),
  )
  const toCollect = visible
    .filter((order) => order.status !== 'anulado' && order.balanceCop > 0)
    .reduce((sum, order) => sum + order.balanceCop, 0)

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar cliente"
          aria-label="Buscar cliente"
          className="h-11 pl-9 text-base"
          value={query}
          onChange={(event) => setParam('q', event.target.value, '')}
        />
      </div>

      <div role="group" aria-label="Estado de pago" className="flex gap-1.5 overflow-x-auto">
        {[ALL, ...PAYMENT_STATUSES].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={payment === value}
            onClick={() => setParam('pago', value, ALL)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
              payment === value ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {isPaymentStatus(value) ? paymentStatusLabel[value] : 'Todos'}
          </button>
        ))}
      </div>

      <NativeSelect
        aria-label="Estado de entrega"
        containerClassName="w-full"
        className="h-11 text-base"
        value={delivery}
        onChange={(event) => setParam('entrega', event.target.value, NOT_CANCELLED)}
      >
        <NativeSelectOption value={NOT_CANCELLED}>Entrega: todos menos anulados</NativeSelectOption>
        <NativeSelectOption value={ALL}>Entrega: todos</NativeSelectOption>
        {DELIVERY_STATUSES.map((status) => (
          <NativeSelectOption key={status} value={status}>
            {deliveryStatusLabel[status]}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <p className="text-sm text-muted-foreground">
        {visible.length === 1 ? '1 pedido' : `${visible.length} pedidos`}
        {toCollect > 0 && <> · Por cobrar {formatCop(toCollect)}</>}
      </p>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Ningún pedido coincide con los filtros.</p>
      ) : (
        <ul className="grid gap-2">
          {visible.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

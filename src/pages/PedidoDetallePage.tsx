import { Boxes, Copy, Package, Pencil, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useDeleteOrder, useOrder, useUpdateOrderStatus, type OrderDetail, type Payment } from '@/api/orders'
import { useDeletePayment } from '@/api/payments'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PaymentForm } from '@/components/orders/PaymentForm'
import { DeliveryBadge, IncompleteBadge, PaymentBadge } from '@/components/orders/StatusBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { copyText } from '@/lib/clipboard'
import { errorMessage } from '@/lib/errors'
import { formatCop, formatDate, formatPercent, formatPhone, formatTrm, formatUsd } from '@/lib/format'
import { DELIVERY_STATUSES, deliveryStatusLabel, type DeliveryStatus } from '@/lib/order-labels'
import { cn } from '@/lib/utils'
import { buildOrderMessage } from '@/lib/whatsapp'

export function PedidoDetallePage() {
  const { orderId = '' } = useParams()
  const order = useOrder(orderId)

  if (order.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando pedido…</p>
  if (order.isError) {
    return <p className="py-8 text-center text-destructive">No se pudo cargar: {errorMessage(order.error)}</p>
  }
  if (!order.data) return <p className="py-8 text-center text-muted-foreground">Este pedido no existe.</p>

  return <OrderView order={order.data} />
}

function OrderView({ order }: { order: OrderDetail }) {
  const navigate = useNavigate()
  const updateStatus = useUpdateOrderStatus(order.id)
  const deletePayment = useDeletePayment()
  const deleteOrder = useDeleteOrder()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null)

  const changeStatus = async (status: DeliveryStatus) => {
    try {
      await updateStatus.mutateAsync(status)
      toast.success(`Estado: ${deliveryStatusLabel[status]}`)
    } catch (error) {
      toast.error(`No se pudo cambiar el estado: ${errorMessage(error)}`)
    }
  }

  const copyMessage = async () => {
    const message = buildOrderMessage({
      customerName: order.customerName,
      orderedOn: order.orderedOn,
      status: order.status,
      items: order.items,
      totalCop: order.totalCop,
      paidCop: order.paidCop,
      balanceCop: order.balanceCop,
    })
    if (await copyText(message)) toast.success('Mensaje copiado. Pégalo en WhatsApp.')
    else toast.error('No se pudo copiar el mensaje.')
  }

  const removeOrder = async () => {
    try {
      await deleteOrder.mutateAsync(order.id)
      toast.success('Pedido eliminado')
      navigate('/pedidos', { replace: true })
    } catch (error) {
      toast.error(`No se pudo eliminar: ${errorMessage(error)}`)
    }
  }

  const removePayment = async (paymentId: string) => {
    try {
      await deletePayment.mutateAsync(paymentId)
      toast.success('Abono borrado')
    } catch (error) {
      toast.error(`No se pudo borrar el abono: ${errorMessage(error)}`)
    }
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{order.customerName}</h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.orderedOn)}
              {order.customerPhone && <> · WhatsApp {formatPhone(order.customerPhone)}</>}
            </p>
            {order.notes && <p className="mt-1 text-sm">{order.notes}</p>}
          </div>
          <Button asChild variant="outline" size="sm" className="h-10 shrink-0">
            <Link to={`/pedidos/${order.id}/editar`}>
              <Pencil />
              Editar
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <PaymentBadge status={order.paymentStatus} />
          <DeliveryBadge status={order.status} />
        </div>
        <NativeSelect
          aria-label="Estado de entrega"
          containerClassName="w-full"
          className="h-11 text-base"
          value={order.status}
          disabled={updateStatus.isPending}
          onChange={(event) => {
            const status = event.target.value as DeliveryStatus
            if (status === 'anulado') setConfirmCancel(true)
            else void changeStatus(status)
          }}
        >
          {DELIVERY_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              Entrega: {deliveryStatusLabel[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          size="lg"
          className="h-12 text-base"
          onClick={() => (order.incompleteItems > 0 ? setConfirmCopy(true) : void copyMessage())}
        >
          <Copy />
          Copiar mensaje para WhatsApp
        </Button>
      </section>

      <section className="grid gap-2">
        <h3 className="font-semibold">Productos</h3>
        <ul className="divide-y rounded-lg border">
          {order.items.map((item) => (
            <li key={item.id} className="grid gap-1 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  {item.qty} × {item.description}
                </p>
                <p className="shrink-0 font-medium tabular-nums">{formatCop(item.priceCop)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {[
                  item.priceCop > 0 && `${formatCop(Math.round(item.priceCop / item.qty))} c/u`,
                  item.unitCostUsd > 0
                    ? `costo ${formatUsd(item.unitCostUsd)} × TRM ${formatTrm(item.trm)} = ${formatCop(item.costCop)}`
                    : 'sin costo para ti',
                  item.markupEffective !== null && item.priceCop > 0 && `incremento ${formatPercent(item.markupEffective)}`,
                  `ganancia ${formatCop(item.profitCop)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {item.shippingChargedCop > 0 && ` · envío ${formatCop(item.shippingChargedCop)}`}
              </p>
              {(item.fromStock || item.shipmentId || item.incomplete) && (
                <div className="flex flex-wrap gap-1.5">
                  {item.fromStock && (
                    <Badge asChild variant="outline">
                      <Link to={`/inventario/${item.productId}`}>
                        <Boxes />
                        Del inventario
                      </Link>
                    </Badge>
                  )}
                  {item.shipmentId && (
                    <Badge asChild variant="outline">
                      <Link to={`/cajas/${item.shipmentId}`}>
                        <Package />
                        Caja {item.shipmentCode}
                      </Link>
                    </Badge>
                  )}
                  {item.incomplete && (
                    <IncompleteBadge>
                      {`Incompleta · ${[item.trm === 0 && 'falta TRM', item.markupPct === null && item.unitPriceCop === null && 'falta precio']
                        .filter(Boolean)
                        .join(' y ')}`}
                    </IncompleteBadge>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2">
        <h3 className="font-semibold">Totales</h3>
        <dl className="grid gap-1.5 rounded-lg border p-3 text-sm">
          <TotalRow label="Productos" value={order.itemsPriceCop} />
          <TotalRow label="Envío y gestión" value={order.shippingChargedCop} />
          <TotalRow label="Total" value={order.totalCop} strong />
          <TotalRow label="Ganancia en productos" value={order.itemsProfitCop} muted />
          <div className="my-1 border-t" />
          <TotalRow label="Abonado" value={order.paidCop} />
          <TotalRow
            label="Saldo"
            value={order.balanceCop}
            strong
            className={order.balanceCop > 0 ? 'text-amber-700' : 'text-emerald-700'}
          />
        </dl>
      </section>

      <section className="grid gap-2">
        <h3 className="font-semibold">Abonos</h3>
        {order.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay abonos.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  aria-label="Editar abono"
                  onClick={() => setEditingPayment(payment)}
                >
                  <p className="font-medium tabular-nums">{formatCop(payment.amountCop)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[formatDate(payment.paidOn), payment.method, payment.note].filter(Boolean).join(' · ')}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label="Editar abono"
                  onClick={() => setEditingPayment(payment)}
                >
                  <Pencil className="size-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label="Borrar abono"
                  onClick={() => setPaymentToDelete(payment.id)}
                >
                  <Trash2 className="size-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {editingPayment ? (
          <PaymentForm
            key={editingPayment.id}
            orderId={order.id}
            balanceCop={order.balanceCop}
            payment={editingPayment}
            onDone={() => setEditingPayment(null)}
          />
        ) : (
          // La key reinicia el formulario con el nuevo saldo después de cada abono.
          <PaymentForm key={order.balanceCop} orderId={order.id} balanceCop={order.balanceCop} />
        )}
      </section>

      <Button variant="ghost" className="h-11 text-destructive" onClick={() => setConfirmDelete(true)}>
        <Trash2 />
        Eliminar pedido
      </Button>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="¿Anular el pedido?"
        description="Queda como anulado: no cuenta en el inventario ni en el por cobrar. Puedes volver a cambiar el estado después."
        confirmLabel="Anular pedido"
        destructive
        onConfirm={() => void changeStatus('anulado')}
      />
      <ConfirmDialog
        open={confirmCopy}
        onOpenChange={setConfirmCopy}
        title="Hay productos incompletos"
        description={`${order.incompleteItems === 1 ? 'Un producto no tiene' : `${order.incompleteItems} productos no tienen`} TRM o precio, así que el total puede estar mal. ¿Copiar el mensaje igual?`}
        confirmLabel="Copiar igual"
        onConfirm={() => void copyMessage()}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar el pedido completo?"
        description="Se borran el pedido, sus productos y sus abonos. No se puede deshacer. Si solo se cayó, mejor cámbialo a Anulado."
        confirmLabel="Eliminar pedido"
        destructive
        onConfirm={() => void removeOrder()}
      />
      <ConfirmDialog
        open={paymentToDelete !== null}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
        title="¿Borrar este abono?"
        description="El saldo del pedido se vuelve a calcular sin este pago."
        confirmLabel="Borrar abono"
        destructive
        onConfirm={() => paymentToDelete && void removePayment(paymentToDelete)}
      />
    </div>
  )
}

function TotalRow({
  label,
  value,
  strong,
  muted,
  className,
}: {
  label: ReactNode
  value: number
  strong?: boolean
  muted?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'text-base font-semibold', muted && 'text-muted-foreground', className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatCop(value)}</dd>
    </div>
  )
}

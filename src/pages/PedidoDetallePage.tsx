import { Copy, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { useOrder, useUpdateOrderStatus, type OrderDetail } from '@/api/orders'
import { useDeletePayment } from '@/api/payments'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PaymentForm } from '@/components/orders/PaymentForm'
import { DeliveryBadge, IncompleteBadge, PaymentBadge } from '@/components/orders/StatusBadges'
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
  const updateStatus = useUpdateOrderStatus(order.id)
  const deletePayment = useDeletePayment()
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
        <div>
          <h2 className="text-xl font-semibold">{order.customerName}</h2>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.orderedOn)}
            {order.customerPhone && <> · WhatsApp {formatPhone(order.customerPhone)}</>}
          </p>
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
                {item.unitCostUsd > 0
                  ? `${formatUsd(item.unitCostUsd)} × TRM ${formatTrm(item.trm)} · ${
                      item.markupPct !== null ? formatPercent(item.markupPct) : 'sin %'
                    } · costo ${formatCop(item.costCop)} · ganancia ${formatCop(item.profitCop)}`
                  : 'Sin costo para ti'}
                {item.shippingChargedCop > 0 && ` · envío ${formatCop(item.shippingChargedCop)}`}
              </p>
              {item.incomplete && (
                <IncompleteBadge>
                  {`Incompleta · ${[item.trm === 0 && 'falta TRM', item.markupPct === null && 'falta %']
                    .filter(Boolean)
                    .join(' y ')}`}
                </IncompleteBadge>
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
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">{formatCop(payment.amountCop)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[formatDate(payment.paidOn), payment.method, payment.note].filter(Boolean).join(' · ')}
                  </p>
                </div>
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
        {/* La key reinicia el formulario con el nuevo saldo después de cada abono. */}
        <PaymentForm key={order.balanceCop} orderId={order.id} balanceCop={order.balanceCop} />
      </section>

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
        description={`${order.incompleteItems === 1 ? 'Un producto no tiene' : `${order.incompleteItems} productos no tienen`} TRM o %, así que su precio puede estar mal. ¿Copiar el mensaje igual?`}
        confirmLabel="Copiar igual"
        onConfirm={() => void copyMessage()}
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

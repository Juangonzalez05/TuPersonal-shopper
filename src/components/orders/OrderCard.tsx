import { Link } from 'react-router'
import type { OrderSummary } from '@/api/orders'
import { DeliveryBadge, IncompleteBadge, PaymentBadge } from '@/components/orders/StatusBadges'
import { formatCop, formatDate } from '@/lib/format'

export function OrderCard({ order }: { order: OrderSummary }) {
  return (
    <Link
      to={`/pedidos/${order.id}`}
      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{order.customerName}</p>
          <p className="text-xs text-muted-foreground">{formatDate(order.orderedOn)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">{formatCop(order.totalCop)}</p>
          {order.balanceCop > 0 && order.balanceCop !== order.totalCop && (
            <p className="text-xs text-muted-foreground tabular-nums">Saldo {formatCop(order.balanceCop)}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <PaymentBadge status={order.paymentStatus} />
        <DeliveryBadge status={order.status} />
        {order.incompleteItems > 0 && (
          <IncompleteBadge>
            {order.incompleteItems === 1 ? '1 incompleta' : `${order.incompleteItems} incompletas`}
          </IncompleteBadge>
        )}
      </div>
    </Link>
  )
}

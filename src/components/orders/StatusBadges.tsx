import { Badge } from '@/components/ui/badge'
import {
  deliveryStatusClass,
  deliveryStatusLabel,
  paymentStatusClass,
  paymentStatusLabel,
  type DeliveryStatus,
} from '@/lib/order-labels'
import type { PaymentStatus } from '@/lib/pricing'

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge className={paymentStatusClass[status]}>{paymentStatusLabel[status]}</Badge>
}

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  return <Badge className={deliveryStatusClass[status]}>{deliveryStatusLabel[status]}</Badge>
}

export function IncompleteBadge({ children = 'Incompleta' }: { children?: string }) {
  return <Badge className="bg-amber-100 text-amber-900">{children}</Badge>
}

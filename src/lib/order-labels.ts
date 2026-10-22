import type { PaymentStatus } from './pricing'

// Estado de ENTREGA (manual, columna orders.status). En Colombia "cancelado" = "pagado",
// por eso un pedido que se cae es "anulado".
export const DELIVERY_STATUSES = [
  'cotizado',
  'confirmado',
  'comprado',
  'en_transito',
  'en_colombia',
  'entregado',
  'anulado',
] as const

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const deliveryStatusLabel: Record<DeliveryStatus, string> = {
  cotizado: 'Cotizado',
  confirmado: 'Confirmado',
  comprado: 'Comprado',
  en_transito: 'En tránsito',
  en_colombia: 'En Colombia',
  entregado: 'Entregado',
  anulado: 'Anulado',
}

export const deliveryStatusClass: Record<DeliveryStatus, string> = {
  cotizado: 'bg-violet-100 text-violet-900',
  confirmado: 'bg-secondary text-secondary-foreground',
  comprado: 'bg-secondary text-secondary-foreground',
  en_transito: 'bg-secondary text-secondary-foreground',
  en_colombia: 'bg-secondary text-secondary-foreground',
  entregado: 'bg-emerald-100 text-emerald-900',
  anulado: 'bg-red-100 text-red-900',
}

export const isDeliveryStatus = (value: string | null): value is DeliveryStatus =>
  DELIVERY_STATUSES.includes(value as DeliveryStatus)

// Estado de PAGO (derivado del saldo en v_orders / pricing.ts).
export const PAYMENT_STATUSES = ['pendiente', 'separado', 'pagado'] as const satisfies readonly PaymentStatus[]

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pendiente: 'Pendiente',
  separado: 'Separado',
  pagado: 'Pagado',
}

export const paymentStatusClass: Record<PaymentStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-900',
  separado: 'bg-sky-100 text-sky-900',
  pagado: 'bg-emerald-100 text-emerald-900',
}

export const isPaymentStatus = (value: string | null): value is PaymentStatus =>
  PAYMENT_STATUSES.includes(value as PaymentStatus)

export const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Transferencia', 'Otro'] as const

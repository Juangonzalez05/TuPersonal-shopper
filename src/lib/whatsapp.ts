import { formatCop, formatDate } from './format'
import { deliveryStatusLabel, type DeliveryStatus } from './order-labels'

export type MessageOrder = {
  customerName: string
  /** "yyyy-MM-dd" */
  orderedOn: string
  status: DeliveryStatus
  items: { qty: number; description: string; priceCop: number; shippingChargedCop: number }[]
  totalCop: number
  paidCop: number
  balanceCop: number
}

/** Mensaje para pegar en WhatsApp. Los asteriscos son negrita en WhatsApp. */
export function buildOrderMessage(order: MessageOrder): string {
  const isQuote = order.status === 'cotizado'
  const kind = isQuote ? 'esta es la cotización' : 'este es el resumen'
  const lines = [`Hola ${order.customerName}, ${kind} de tu pedido del ${formatDate(order.orderedOn)}:`, '']

  for (const item of order.items) {
    const amount = item.priceCop > 0 ? formatCop(item.priceCop) : 'solo envío/gestión'
    lines.push(`• ${item.qty} × ${item.description}: ${amount}`)
  }
  lines.push('')

  const shipping = order.items.reduce((sum, item) => sum + item.shippingChargedCop, 0)
  if (shipping > 0) lines.push(`Envío y gestión: ${formatCop(shipping)}`)
  lines.push(`*Total: ${formatCop(order.totalCop)}*`)
  if (order.paidCop > 0) lines.push(`Abonado: ${formatCop(order.paidCop)}`)
  if (order.balanceCop <= 0) lines.push('*Pagado* ✓')
  else if (order.paidCop > 0) lines.push(`*Saldo: ${formatCop(order.balanceCop)}*`)

  lines.push('')
  if (isQuote) lines.push('Si estás de acuerdo, me confirmas para hacer la compra.')
  else lines.push(`Estado: ${deliveryStatusLabel[order.status]}`)

  return lines.join('\n')
}

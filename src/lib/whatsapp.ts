import { formatCop, formatDate } from './format'
import { deliveryStatusLabel, type DeliveryStatus } from './order-labels'

export type MessageOrder = {
  kind?: 'pedido' | 'kit'
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

  // En un kit, el contenido va en 0: se lista debajo de la cajita, sin precio.
  const inKit = (item: MessageOrder['items'][number]) =>
    order.kind === 'kit' && item.priceCop === 0 && item.shippingChargedCop === 0
  const contents = order.items.filter(inKit)

  // Cada producto con lo que paga el cliente: el envío / gestión va incluido, no se suma aparte.
  for (const item of order.items.filter((item) => !inKit(item))) {
    const amount =
      item.priceCop > 0
        ? formatCop(item.priceCop + item.shippingChargedCop)
        : `${formatCop(item.shippingChargedCop)} (envío/gestión)`
    lines.push(`• ${item.qty} × ${item.description}: ${amount}`)
  }
  if (contents.length > 0) {
    lines.push('Incluye:')
    for (const item of contents) lines.push(`   - ${item.qty} × ${item.description}`)
  }
  lines.push('')

  lines.push(`*Total: ${formatCop(order.totalCop)}*`)
  if (order.paidCop > 0) lines.push(`Abonado: ${formatCop(order.paidCop)}`)
  if (order.balanceCop <= 0) lines.push('*Pagado* ✓')
  else if (order.paidCop > 0) lines.push(`*Saldo: ${formatCop(order.balanceCop)}*`)

  lines.push('')
  if (isQuote) lines.push('Si estás de acuerdo, me confirmas para hacer la compra.')
  else lines.push(`Estado: ${deliveryStatusLabel[order.status]}`)

  return lines.join('\n')
}

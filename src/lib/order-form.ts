// Modelo del formulario "Nuevo pedido". Los números viajan como texto (lo que se escribe)
// y se leen con format.ts tanto para el cálculo en vivo como al guardar.

import { z } from 'zod'
import type { CreateOrderArgs } from '@/api/orders'
import {
  decimalInputValue,
  parseCop,
  parseDecimal,
  parsePercent,
  percentInputValue,
  phoneDigits,
} from '@/lib/format'
import type { LineInput } from '@/lib/pricing'

// Límites de las columnas: numeric(10,2) para USD/TRM y numeric(6,4) para el %.
const MAX_DECIMAL = 99_999_999.99
const MAX_PERCENT = 9_999.99

const isBlank = (value: string) => value.trim() === ''

const optionalNumber = (max: number, message: string) =>
  z.string().refine((value) => {
    if (isBlank(value)) return true
    const n = parseDecimal(value)
    return n !== null && n <= max
  }, message)

const lineSchema = z.object({
  productId: z.string().nullable(),
  description: z.string().trim().min(1, 'Escribe o elige el producto.'),
  usd: optionalNumber(MAX_DECIMAL, 'Valor en USD inválido.'),
  qty: z.string().refine((value) => {
    const n = parseDecimal(value)
    return n !== null && Number.isInteger(n) && n >= 1 && n <= 100_000
  }, 'Cantidad entera desde 1.'),
  trm: optionalNumber(MAX_DECIMAL, 'TRM inválida.'),
  pct: optionalNumber(MAX_PERCENT, '% inválido.'),
  shipping: optionalNumber(MAX_DECIMAL, 'Valor inválido.'),
})

export const orderFormSchema = z.object({
  customerId: z.string().nullable(),
  customerName: z.string().trim().min(1, 'Elige un cliente o escribe uno nuevo.'),
  customerPhone: z.string(),
  status: z.enum(['cotizado', 'confirmado']),
  orderedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  lines: z.array(lineSchema).min(1, 'Agrega al menos un producto.'),
  initialPayment: optionalNumber(MAX_DECIMAL, 'Valor inválido.'),
  paymentMethod: z.string(),
})

export type OrderFormValues = z.infer<typeof orderFormSchema>
export type OrderLineValues = OrderFormValues['lines'][number]

export function emptyLine(prefill: { trm?: number | null; markupPct?: number | null } = {}): OrderLineValues {
  return {
    productId: null,
    description: '',
    usd: '',
    qty: '1',
    trm: prefill.trm != null ? decimalInputValue(prefill.trm) : '',
    pct: prefill.markupPct != null ? percentInputValue(prefill.markupPct) : '',
    shipping: '',
  }
}

export function emptyOrder(today: string): OrderFormValues {
  return {
    customerId: null,
    customerName: '',
    customerPhone: '',
    status: 'cotizado',
    orderedOn: today,
    lines: [emptyLine()],
    initialPayment: '',
    paymentMethod: '',
  }
}

/** Lo escrito en una línea, como entrada de pricing.ts (lo vacío o inválido cuenta como 0 / sin %). */
export function toLineInput(line: OrderLineValues): LineInput {
  const qty = parseDecimal(line.qty)
  return {
    unitCostUsd: parseDecimal(line.usd) ?? 0,
    trm: parseDecimal(line.trm) ?? 0,
    qty: qty !== null && Number.isInteger(qty) && qty > 0 ? qty : 1,
    markupPct: parsePercent(line.pct),
    shippingChargedCop: parseCop(line.shipping) ?? 0,
  }
}

export function toCreateOrderArgs(values: OrderFormValues): CreateOrderArgs {
  const payment = parseCop(values.initialPayment) ?? 0
  const phone = phoneDigits(values.customerPhone)
  return {
    p_customer_id: values.customerId ?? undefined,
    p_customer_name: values.customerId ? undefined : values.customerName.trim(),
    p_customer_phone: values.customerId || phone === '' ? undefined : phone,
    p_ordered_on: values.orderedOn,
    p_status: values.status,
    p_items: values.lines.map((line) => {
      const input = toLineInput(line)
      return {
        product_id: line.productId,
        description: line.description.trim(),
        qty: input.qty,
        unit_cost_usd: input.unitCostUsd,
        trm: input.trm,
        markup_pct: input.markupPct,
        shipping_charged_cop: input.shippingChargedCop,
      }
    }),
    p_initial_payment_cop: payment,
    p_payment_method: payment > 0 && values.paymentMethod ? values.paymentMethod : undefined,
  }
}

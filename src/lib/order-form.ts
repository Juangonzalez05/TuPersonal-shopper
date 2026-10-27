// Modelo del formulario de pedido (crear y editar). Los números viajan como texto (lo que se
// escribe) y se leen con format.ts tanto para el cálculo en vivo como al guardar.
//
// Ella escribe el precio c/u que le da al cliente; el % de incremento sale solo (pricing.ts).

import { z } from 'zod'
import type { CreateOrderArgs, OrderDetail, UpdateOrderArgs } from '@/api/orders'
import { decimalInputValue, parseCop, parseDecimal, phoneDigits } from '@/lib/format'
import { orderTotals, type LineInput } from '@/lib/pricing'

// Límites de las columnas: numeric(10,2) para USD/TRM.
const MAX_DECIMAL = 99_999_999.99
const MAX_COP = 999_999_999_999

const isBlank = (value: string) => value.trim() === ''

const optionalNumber = (max: number, message: string) =>
  z.string().refine((value) => {
    if (isBlank(value)) return true
    const n = parseDecimal(value)
    return n !== null && n <= max
  }, message)

const lineSchema = z
  .object({
    /** Línea ya guardada (al editar); null = nueva. */
    id: z.string().nullable(),
    productId: z.string().nullable(),
    /** "Sale del inventario": descuenta del stock en vez de comprarse por encargo. */
    fromStock: z.boolean(),
    description: z.string().trim().min(1, 'Escribe o elige el producto.'),
    usd: optionalNumber(MAX_DECIMAL, 'Valor en USD inválido.'),
    qty: z.string().refine((value) => {
      const n = parseDecimal(value)
      return n !== null && Number.isInteger(n) && n >= 1 && n <= 100_000
    }, 'Cantidad entera desde 1.'),
    trm: optionalNumber(MAX_DECIMAL, 'TRM inválida.'),
    /** Precio c/u al cliente en COP. Vacío = aún no tiene precio. */
    price: optionalNumber(MAX_COP, 'Precio inválido.'),
    shipping: optionalNumber(MAX_COP, 'Valor inválido.'),
  })
  .refine((line) => !line.fromStock || line.productId !== null, {
    path: ['description'],
    message: 'Para sacar del inventario elige un producto del catálogo.',
  })

export const PAYMENT_MODES = ['none', 'abono', 'total'] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const orderFormSchema = z
  .object({
    customerId: z.string().nullable(),
    customerName: z.string().trim().min(1, 'Elige un cliente o escribe uno nuevo.'),
    customerPhone: z.string(),
    status: z.enum(['cotizado', 'confirmado']),
    orderedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
    lines: z.array(lineSchema).min(1, 'Agrega al menos un producto.'),
    notes: z.string(),
    /** Pago al crear: sin pago todavía, abono o pagado completo. */
    paymentMode: z.enum(PAYMENT_MODES),
    initialPayment: optionalNumber(MAX_COP, 'Valor inválido.'),
    paymentMethod: z.string(),
  })
  .refine((values) => values.paymentMode !== 'abono' || (parseCop(values.initialPayment) ?? 0) > 0, {
    path: ['initialPayment'],
    message: 'Escribe cuánto abonó.',
  })

export type OrderFormValues = z.infer<typeof orderFormSchema>
export type OrderLineValues = OrderFormValues['lines'][number]

export function emptyLine(prefill: { trm?: number | null; unitPriceCop?: number | null } = {}): OrderLineValues {
  return {
    id: null,
    productId: null,
    fromStock: false,
    description: '',
    usd: '',
    qty: '1',
    trm: prefill.trm != null ? decimalInputValue(prefill.trm) : '',
    price: prefill.unitPriceCop != null ? String(prefill.unitPriceCop) : '',
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
    notes: '',
    paymentMode: 'none',
    initialPayment: '',
    paymentMethod: '',
  }
}

/** Pedido guardado → formulario de edición. Las líneas viejas sin precio c/u lo toman del precio calculado. */
export function orderToFormValues(order: OrderDetail): OrderFormValues {
  return {
    customerId: order.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? '',
    status: order.status === 'cotizado' ? 'cotizado' : 'confirmado',
    orderedOn: order.orderedOn,
    notes: order.notes ?? '',
    lines: order.items.map((item) => {
      const unitPrice = item.unitPriceCop ?? (item.priceCop > 0 ? Math.round(item.priceCop / item.qty) : null)
      return {
        id: item.id,
        productId: item.productId,
        fromStock: item.fromStock,
        description: item.description,
        usd: item.unitCostUsd > 0 ? decimalInputValue(item.unitCostUsd) : '',
        qty: String(item.qty),
        trm: item.trm > 0 ? decimalInputValue(item.trm) : '',
        price: unitPrice !== null ? String(unitPrice) : '',
        shipping: item.shippingChargedCop > 0 ? String(item.shippingChargedCop) : '',
      }
    }),
    paymentMode: 'none',
    initialPayment: '',
    paymentMethod: '',
  }
}

/** Lo escrito en una línea, como entrada de pricing.ts (lo vacío o inválido cuenta como 0 / sin precio). */
export function toLineInput(line: OrderLineValues): LineInput {
  const qty = parseDecimal(line.qty)
  return {
    unitCostUsd: parseDecimal(line.usd) ?? 0,
    trm: parseDecimal(line.trm) ?? 0,
    qty: qty !== null && Number.isInteger(qty) && qty > 0 ? qty : 1,
    markupPct: null,
    unitPriceCop: parseCop(line.price),
    shippingChargedCop: parseCop(line.shipping) ?? 0,
  }
}

/** Cuánto se registra como pago al crear: nada, el abono escrito o el total del pedido. */
export function initialPaymentCop(values: OrderFormValues): number {
  if (values.paymentMode === 'abono') return parseCop(values.initialPayment) ?? 0
  if (values.paymentMode === 'total') return orderTotals(values.lines.map(toLineInput), 0).totalCop
  return 0
}

function toItems(lines: OrderLineValues[]) {
  return lines.map((line) => {
    const input = toLineInput(line)
    return {
      ...(line.id ? { id: line.id } : {}),
      product_id: line.productId,
      description: line.description.trim(),
      qty: input.qty,
      unit_cost_usd: input.unitCostUsd,
      trm: input.trm,
      markup_pct: null,
      unit_price_cop: input.unitPriceCop,
      shipping_charged_cop: input.shippingChargedCop,
      from_stock: line.fromStock,
    }
  })
}

function customerArgs(values: OrderFormValues) {
  const phone = phoneDigits(values.customerPhone)
  return {
    p_customer_id: values.customerId ?? undefined,
    p_customer_name: values.customerId ? undefined : values.customerName.trim(),
    p_customer_phone: values.customerId || phone === '' ? undefined : phone,
  }
}

export function toCreateOrderArgs(values: OrderFormValues): CreateOrderArgs {
  const payment = initialPaymentCop(values)
  return {
    ...customerArgs(values),
    p_ordered_on: values.orderedOn,
    p_status: values.status,
    p_notes: values.notes.trim() || undefined,
    p_items: toItems(values.lines),
    p_initial_payment_cop: payment,
    p_payment_method: payment > 0 && values.paymentMethod ? values.paymentMethod : undefined,
  }
}

export function toUpdateOrderArgs(orderId: string, values: OrderFormValues): UpdateOrderArgs {
  return {
    p_order_id: orderId,
    ...customerArgs(values),
    p_ordered_on: values.orderedOn,
    p_notes: values.notes.trim() || undefined,
    p_items: toItems(values.lines),
  }
}

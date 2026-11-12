import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '@/api/orders'
import {
  emptyLine,
  emptyOrder,
  formLineInputs,
  initialPaymentCop,
  orderFormSchema,
  orderToFormValues,
  toCreateOrderArgs,
  toLineInput,
  toUpdateOrderArgs,
  type OrderFormValues,
} from './order-form'
import { impliedMarkup, lineTotals, orderTotals } from './pricing'

// Caso A del roadmap escrito como lo haría ella en el celular: precio c/u al cliente 63.500,
// que ya trae los 15.000 de envío (2 × 63.500 = 127.000).
const caseA: OrderFormValues = {
  ...emptyOrder('2026-10-22'),
  customerName: ' María Pérez ',
  customerPhone: '300 123 4567',
  lines: [
    {
      id: null,
      productId: 'p-1',
      fromStock: false,
      description: 'Crema Medicube',
      usd: '10',
      qty: '2',
      trm: '4.000',
      price: '63.500',
      shipping: '15.000',
    },
  ],
  paymentMode: 'abono',
  initialPayment: '50.000',
  paymentMethod: 'Nequi',
}

describe('toLineInput', () => {
  it('lee lo escrito y da los números del caso A con el 40 % calculado', () => {
    const totals = lineTotals(toLineInput(caseA.lines[0]))
    expect(totals).toMatchObject({ costCop: 80_000, priceCop: 112_000, totalCop: 127_000 })
    expect(impliedMarkup(totals.costCop, totals.priceCop)).toBe(0.4)
  })

  it('lo vacío cuenta como 0 y sin precio', () => {
    expect(toLineInput(emptyLine())).toEqual({
      unitCostUsd: 0,
      trm: 0,
      qty: 1,
      markupPct: null,
      unitPriceCop: null,
      shippingChargedCop: 0,
    })
  })
})

describe('emptyLine', () => {
  it('prellena TRM y precio como texto editable', () => {
    expect(emptyLine({ trm: 4123.45, unitPriceCop: 56_000 })).toMatchObject({ trm: '4123,45', price: '56000' })
  })
})

describe('pago al crear', () => {
  it('sin pago, abono escrito o el total del pedido', () => {
    expect(initialPaymentCop({ ...caseA, paymentMode: 'none' })).toBe(0)
    expect(initialPaymentCop(caseA)).toBe(50_000)
    expect(initialPaymentCop({ ...caseA, paymentMode: 'total', initialPayment: '' })).toBe(127_000)
  })

  it('abono exige valor; pagado completo y sin pago no', () => {
    expect(orderFormSchema.safeParse({ ...caseA, initialPayment: '' }).success).toBe(false)
    expect(orderFormSchema.safeParse({ ...caseA, paymentMode: 'total', initialPayment: '' }).success).toBe(true)
    expect(orderFormSchema.safeParse({ ...caseA, paymentMode: 'none', initialPayment: '' }).success).toBe(true)
  })

  it('se puede guardar sin precio todavía', () => {
    const noPrice = { ...caseA, paymentMode: 'none' as const, lines: [{ ...caseA.lines[0], price: '' }] }
    expect(orderFormSchema.safeParse(noPrice).success).toBe(true)
    expect(lineTotals(toLineInput(noPrice.lines[0])).missing).toEqual(['price'])
  })
})

describe('toCreateOrderArgs', () => {
  it('cliente nuevo: manda nombre y WhatsApp en dígitos, precio c/u y el abono', () => {
    expect(toCreateOrderArgs(caseA)).toEqual({
      p_customer_id: undefined,
      p_customer_name: 'María Pérez',
      p_customer_phone: '3001234567',
      p_ordered_on: '2026-10-22',
      p_status: 'cotizado',
      p_notes: undefined,
      p_items: [
        {
          product_id: 'p-1',
          description: 'Crema Medicube',
          qty: 2,
          unit_cost_usd: 10,
          trm: 4000,
          markup_pct: null,
          unit_price_cop: 63_500,
          shipping_charged_cop: 15_000,
          from_stock: false,
        },
      ],
      p_initial_payment_cop: 50_000,
      p_payment_method: 'Nequi',
      kind: 'pedido',
    })
  })

  it('pagado completo registra el total', () => {
    expect(toCreateOrderArgs({ ...caseA, paymentMode: 'total' }).p_initial_payment_cop).toBe(127_000)
  })

  it('cliente existente: solo manda el id; sin pago no manda medio de pago', () => {
    const args = toCreateOrderArgs({ ...caseA, customerId: 'c-1', paymentMode: 'none' })
    expect(args).toMatchObject({ p_customer_id: 'c-1', p_initial_payment_cop: 0 })
    expect(args.p_customer_name).toBeUndefined()
    expect(args.p_customer_phone).toBeUndefined()
    expect(args.p_payment_method).toBeUndefined()
  })
})

const saved: OrderDetail = {
  id: 'o-1',
  customerId: 'c-1',
  customerName: 'María',
  customerPhone: null,
  orderedOn: '2026-10-22',
  status: 'comprado',
  notes: null,
  itemsPriceCop: 112_000,
  itemsCostCop: 80_000,
  itemsProfitCop: 32_000,
  shippingChargedCop: 15_000,
  totalCop: 127_000,
  paidCop: 0,
  balanceCop: 127_000,
  paymentStatus: 'pendiente',
  incompleteItems: 0,
  stockShippingCop: 0,
  stockShippingUnits: 0,
  stockBoxedUnits: 0,
  stockBoxedRealCop: 0,
  kind: 'pedido',
  payments: [],
  items: [
    {
      id: 'l-1',
      productId: null,
      description: 'Pedido viejo con %',
      qty: 2,
      unitCostUsd: 10,
      trm: 4000,
      markupPct: 0.4,
      unitPriceCop: null,
      markupEffective: 0.4,
      shippingChargedCop: 15_000,
      costCop: 80_000,
      priceCop: 112_000,
      profitCop: 32_000,
      incomplete: false,
      fromStock: false,
      shipmentId: 's-1',
      shipmentCode: 'ENV-001',
    },
  ],
}
describe('editar pedido', () => {

  it('una línea vieja con % toma el precio c/u con el envío incluido (mismo total) y conserva su id', () => {
    const values = orderToFormValues(saved)
    // (112.000 + 15.000) / 2
    expect(values.lines[0]).toMatchObject({ id: 'l-1', price: '63500', usd: '10', trm: '4000', shipping: '15000' })
    expect(values.status).toBe('confirmado')
  })

  it('manda las líneas con id para conservar su caja y las nuevas sin id', () => {
    const values = orderToFormValues(saved)
    const args = toUpdateOrderArgs('o-1', { ...values, lines: [...values.lines, { ...emptyLine(), description: 'Nueva' }] })
    expect(args.p_order_id).toBe('o-1')
    expect(args.p_customer_id).toBe('c-1')
    expect(args.p_items).toMatchObject([{ id: 'l-1', unit_price_cop: 63_500 }, { description: 'Nueva' }])
    expect((args.p_items as { id?: string }[])[1].id).toBeUndefined()
  })
})

describe('orderFormSchema', () => {
  it('acepta el caso A', () => {
    expect(orderFormSchema.safeParse(caseA).success).toBe(true)
  })

  it('pide cliente, producto y cantidad entera', () => {
    const result = orderFormSchema.safeParse({
      ...caseA,
      customerName: ' ',
      lines: [{ ...caseA.lines[0], description: '', qty: '1,5' }],
    })
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((issue) => issue.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['customerName', 'lines.0.description', 'lines.0.qty']))
  })

  it('"sale del inventario" exige un producto del catálogo', () => {
    const freeText = { ...caseA.lines[0], productId: null, fromStock: true }
    const result = orderFormSchema.safeParse({ ...caseA, lines: [freeText] })
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((issue) => issue.path.join('.'))).toEqual(['lines.0.description'])

    const fromCatalog = { ...caseA, lines: [{ ...caseA.lines[0], fromStock: true }] }
    expect(orderFormSchema.safeParse(fromCatalog).success).toBe(true)
    expect(toCreateOrderArgs(fromCatalog).p_items).toMatchObject([{ product_id: 'p-1', from_stock: true }])
  })
})

describe('pedido tipo kit', () => {
  // 2 cajitas de 60.000 (5.000 de envío incluido) con un producto del inventario de 5 USD × 4.000.
  const kit: OrderFormValues = {
    ...emptyOrder('2026-11-12'),
    customerName: 'Ana',
    kind: 'kit',
    kit: { id: null, name: 'Kit Spa', qty: '2', price: '60000', shipping: '5000' },
    lines: [
      { ...emptyLine(), productId: 'p-1', fromStock: true, description: 'Crema', qty: '2', usd: '5', trm: '4000', price: '99000' },
    ],
  }

  it('guarda la línea del kit con su precio y el contenido con precio 0 y sin envío', () => {
    const items = toCreateOrderArgs(kit).p_items as Record<string, unknown>[]
    expect(items[0]).toMatchObject({ product_id: null, description: 'Kit Spa', qty: 2, unit_price_cop: 60_000, shipping_charged_cop: 5_000, unit_cost_usd: 0 })
    expect(items[1]).toMatchObject({ product_id: 'p-1', from_stock: true, qty: 2, unit_price_cop: 0, shipping_charged_cop: 0, unit_cost_usd: 5 })
    expect(toCreateOrderArgs(kit).kind).toBe('kit')
  })

  it('total = precio × cajitas y ganancia = total − costo del contenido', () => {
    expect(orderTotals(formLineInputs(kit), 0)).toMatchObject({ totalCop: 120_000, itemsCostCop: 40_000 })
    expect(initialPaymentCop({ ...kit, paymentMode: 'total' })).toBe(120_000)
  })

  it('sin precio de la cajita no se puede guardar', () => {
    expect(orderFormSchema.safeParse({ ...kit, kit: { ...kit.kit, price: '' } }).success).toBe(false)
  })

  it('al editar separa la línea del kit del contenido', () => {
    const line = (o: Partial<OrderDetail['items'][number]>) => ({ ...saved.items[0], markupPct: null, shipmentId: null, shipmentCode: null, ...o })
    const values = orderToFormValues({
      ...saved,
      kind: 'kit',
      items: [
        line({ id: 'k', description: 'Kit', qty: 2, unitCostUsd: 0, unitPriceCop: 60_000, shippingChargedCop: 5_000 }),
        line({ id: 'c', productId: 'p-1', fromStock: true, description: 'Crema', qty: 2, unitPriceCop: 0, shippingChargedCop: 0 }),
      ],
    })
    expect(values.kind).toBe('kit')
    expect(values.kit).toEqual({ id: 'k', name: '', qty: '2', price: '60000', shipping: '5000' })
    expect(values.lines).toHaveLength(1)
    expect(values.lines[0]).toMatchObject({ id: 'c', description: 'Crema' })
  })
})

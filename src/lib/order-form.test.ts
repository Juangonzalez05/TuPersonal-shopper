import { describe, expect, it } from 'vitest'
import { emptyLine, emptyOrder, orderFormSchema, toCreateOrderArgs, toLineInput, type OrderFormValues } from './order-form'
import { lineTotals } from './pricing'

// Caso A del roadmap escrito como lo haría ella en el celular.
const caseA: OrderFormValues = {
  ...emptyOrder('2026-10-22'),
  customerName: ' María Pérez ',
  customerPhone: '300 123 4567',
  lines: [
    {
      productId: 'p-1',
      fromStock: false,
      description: 'Crema Medicube',
      usd: '10',
      qty: '2',
      trm: '4.000',
      pct: '40',
      shipping: '15.000',
    },
  ],
  initialPayment: '50.000',
  paymentMethod: 'Nequi',
}

describe('toLineInput', () => {
  it('lee lo escrito y da los números del caso A', () => {
    expect(lineTotals(toLineInput(caseA.lines[0]))).toMatchObject({
      costCop: 80_000,
      priceCop: 112_000,
      totalCop: 127_000,
    })
  })

  it('lo vacío cuenta como 0 y el % vacío queda como faltante', () => {
    expect(toLineInput(emptyLine())).toEqual({
      unitCostUsd: 0,
      trm: 0,
      qty: 1,
      markupPct: null,
      shippingChargedCop: 0,
    })
  })
})

describe('emptyLine', () => {
  it('prellena TRM y % como texto editable', () => {
    expect(emptyLine({ trm: 4123.45, markupPct: 0.4 })).toMatchObject({ trm: '4123,45', pct: '40' })
  })
})

describe('toCreateOrderArgs', () => {
  it('cliente nuevo: manda nombre y WhatsApp en dígitos, líneas en números y el abono', () => {
    expect(toCreateOrderArgs(caseA)).toEqual({
      p_customer_id: undefined,
      p_customer_name: 'María Pérez',
      p_customer_phone: '3001234567',
      p_ordered_on: '2026-10-22',
      p_status: 'cotizado',
      p_items: [
        {
          product_id: 'p-1',
          description: 'Crema Medicube',
          qty: 2,
          unit_cost_usd: 10,
          trm: 4000,
          markup_pct: 0.4,
          shipping_charged_cop: 15_000,
          from_stock: false,
        },
      ],
      p_initial_payment_cop: 50_000,
      p_payment_method: 'Nequi',
    })
  })

  it('cliente existente: solo manda el id; sin abono no manda medio de pago', () => {
    const args = toCreateOrderArgs({ ...caseA, customerId: 'c-1', initialPayment: '' })
    expect(args).toMatchObject({ p_customer_id: 'c-1', p_initial_payment_cop: 0 })
    expect(args.p_customer_name).toBeUndefined()
    expect(args.p_customer_phone).toBeUndefined()
    expect(args.p_payment_method).toBeUndefined()
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

  it('rechaza números que no caben en la base', () => {
    const result = orderFormSchema.safeParse({ ...caseA, lines: [{ ...caseA.lines[0], pct: '10000' }] })
    expect(result.success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { OrderLineExport, OrderSummary } from '@/api/orders'
import type { Shipment } from '@/api/shipments'
import { csvDecimal, csvPercent, toCsv } from './csv'
import { orderLinesCsv, ordersCsv, shipmentsCsv } from './exports'

/** Filas del CSV sin BOM ni el salto final. */
const lines = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n')

describe('toCsv', () => {
  it('empieza con BOM, separa con ; y termina cada fila en CRLF', () => {
    const csv = toCsv(['A', 'B'], [[1, 'x']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿A;B\r\n1;x\r\n')
  })

  it('pone comillas solo cuando hace falta y duplica las internas', () => {
    expect(lines(toCsv(['x'], [['Cremas; juicy'], ['Dice "hola"'], ['dos\nlíneas'], ['normal']]))).toEqual([
      'x',
      '"Cremas; juicy"',
      '"Dice ""hola"""',
      '"dos\nlíneas"',
      'normal',
    ])
  })

  it('vacíos y sí/no', () => {
    expect(lines(toCsv(['a', 'b', 'c', 'd'], [[null, undefined, true, false]]))[1]).toBe(';;Sí;No')
  })

  it('decimales con coma y porcentajes que Excel reconoce', () => {
    expect(csvDecimal(4123.45)).toBe('4123,45')
    expect(csvDecimal(10)).toBe('10')
    expect(csvPercent(0.4)).toBe('40%')
    expect(csvPercent(0.355)).toBe('35,5%')
    expect(csvPercent(null)).toBeNull()
  })
})

describe('exportaciones', () => {
  it('pedidos: una fila por pedido con totales y estados', () => {
    const order: OrderSummary = {
      id: 'o1',
      customerId: 'c1',
      customerName: 'María',
      customerPhone: '3001234567',
      orderedOn: '2026-10-05',
      status: 'comprado',
      notes: null,
      itemsPriceCop: 112_000,
      itemsCostCop: 80_000,
      itemsProfitCop: 32_000,
      shippingChargedCop: 15_000,
      totalCop: 127_000,
      paidCop: 50_000,
      balanceCop: 77_000,
      paymentStatus: 'separado',
      incompleteItems: 0,
    }
    expect(lines(ordersCsv([order]))[1]).toBe(
      '05/10/2026;María;3001234567;Comprado;Separado;112000;15000;127000;80000;32000;50000;77000;0;',
    )
  })

  it('productos vendidos: como la hoja "Productos y ventas"', () => {
    const line: OrderLineExport = {
      id: 'l1',
      productId: 'p1',
      description: 'Crema Medicube',
      qty: 1,
      unitCostUsd: 7.99,
      trm: 4123.45,
      markupPct: 0.4,
      shippingChargedCop: 0,
      costCop: 32_946,
      priceCop: 46_100,
      profitCop: 13_154,
      incomplete: false,
      fromStock: false,
      shipmentId: 's1',
      shipmentCode: 'ENV-001',
      orderedOn: '2026-10-10',
      orderStatus: 'entregado',
      customerName: 'Ana',
    }
    expect(lines(orderLinesCsv([line]))[1]).toBe(
      '10/10/2026;Ana;Crema Medicube;1;7,99;4123,45;32946;40%;46100;0;ENV-001;No;No;Entregado',
    )
  })

  it('cajas: como "Control de envíos", sin diferencia mientras está por cerrar', () => {
    const shipment: Shipment = {
      id: 's1',
      code: 'ENV-002',
      carrier: 'Aeropost',
      arrivedOn: null,
      realCostCop: null,
      notes: 'frágil',
      itemsCount: 3,
      chargedCop: 27_000,
      state: 'por_cerrar',
      differenceCop: null,
      createdAt: '2026-10-20T15:00:00Z',
    }
    expect(lines(shipmentsCsv([shipment]))[1]).toBe(';ENV-002;Aeropost;3;;27000;;Por cerrar;frágil')
  })
})

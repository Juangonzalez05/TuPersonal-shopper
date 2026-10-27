import { describe, expect, it } from 'vitest'
import { boxStockFromRows, nextShipmentCode, shipmentFields, shipmentSubtitle } from './shipments'

describe('nextShipmentCode', () => {
  it('empieza en ENV-001', () => {
    expect(nextShipmentCode([])).toBe('ENV-001')
  })

  it('sigue después del mayor, aunque haya huecos o desorden', () => {
    expect(nextShipmentCode(['ENV-002', 'ENV-009', 'ENV-004'])).toBe('ENV-010')
  })

  it('ignora mayúsculas, espacios y códigos con otro formato', () => {
    expect(nextShipmentCode([' env-12 ', 'Caja Miami', 'ENV-A'])).toBe('ENV-013')
  })

  it('no se queda en tres dígitos', () => {
    expect(nextShipmentCode(['ENV-999'])).toBe('ENV-1000')
  })
})

describe('shipmentFields', () => {
  it('limpia lo escrito: código en mayúsculas y vacíos como null', () => {
    expect(
      shipmentFields({
        code: ' env-004 ',
        carrier: '  ',
        shippedOn: '2026-10-20',
        expectedOn: '',
        realCost: '85.000',
        notes: ' frágil ',
      }),
    ).toEqual({
      code: 'ENV-004',
      carrier: null,
      shippedOn: '2026-10-20',
      expectedOn: null,
      realCostCop: 85_000,
      notes: 'frágil',
    })
  })
})

describe('shipmentSubtitle', () => {
  it('muestra courier, despacho y llegada estimada mientras viene en camino', () => {
    expect(
      shipmentSubtitle({ carrier: 'Aeropost', shippedOn: '2026-10-20', expectedOn: '2026-10-31', arrivedOn: null }),
    ).toBe('Aeropost · despachada 20/10/2026 · llega aprox. 31/10/2026')
  })

  it('al llegar muestra la llegada real en vez de la estimada', () => {
    expect(
      shipmentSubtitle({ carrier: null, shippedOn: null, expectedOn: '2026-10-31', arrivedOn: '2026-10-30' }),
    ).toBe('llegó 30/10/2026')
  })
})

describe('boxStockFromRows', () => {
  it('ignora filas vacías y convierte cantidad y costo', () => {
    expect(
      boxStockFromRows([
        { productId: 'p-1', productName: 'Carmex ', qty: '3', usd: '1,6' },
        { productId: null, productName: '  ', qty: '1', usd: '' },
        { productId: null, productName: 'Nuevo', qty: '2', usd: '' },
      ]),
    ).toEqual([
      { productId: 'p-1', productName: 'Carmex', qty: 3, unitCostUsd: 1.6 },
      { productId: null, productName: 'Nuevo', qty: 2, unitCostUsd: null },
    ])
  })
})

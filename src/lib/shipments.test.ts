import { describe, expect, it } from 'vitest'
import { nextShipmentCode, shipmentFields, shipmentSubtitle } from './shipments'

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
    expect(shipmentFields({ code: ' env-004 ', carrier: '  ', arrivedOn: '', notes: ' frágil ' })).toEqual({
      code: 'ENV-004',
      carrier: null,
      arrivedOn: null,
      notes: 'frágil',
    })
  })
})

describe('shipmentSubtitle', () => {
  it('muestra courier y llegada, o que aún no llega', () => {
    expect(shipmentSubtitle({ carrier: 'Aeropost', arrivedOn: '2026-10-22' })).toBe('Aeropost · llegó 22/10/2026')
    expect(shipmentSubtitle({ carrier: null, arrivedOn: null })).toBe('sin fecha de llegada')
  })
})

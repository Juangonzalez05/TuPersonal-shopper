import { describe, expect, it } from 'vitest'
import { nextShipmentCode } from './shipments'

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

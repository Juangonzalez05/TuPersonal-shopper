import { describe, expect, it } from 'vitest'
import { buildOrderMessage, type MessageOrder } from './whatsapp'

const plain = (s: string) => s.replace(/ /g, ' ')

const caseA: MessageOrder = {
  customerName: 'María',
  orderedOn: '2026-10-22',
  status: 'comprado',
  items: [
    { qty: 2, description: 'Crema Medicube', priceCop: 112_000, shippingChargedCop: 15_000 },
    { qty: 1, description: 'Perfume que trajo ella', priceCop: 0, shippingChargedCop: 12_000 },
  ],
  totalCop: 139_000,
  paidCop: 50_000,
  balanceCop: 89_000,
}

describe('buildOrderMessage', () => {
  it('arma el resumen con líneas (envío incluido), total, abono, saldo y estado', () => {
    expect(plain(buildOrderMessage(caseA))).toBe(
      [
        'Hola María, este es el resumen de tu pedido del 22/10/2026:',
        '',
        '• 2 × Crema Medicube: $ 127.000',
        '• 1 × Perfume que trajo ella: $ 12.000 (envío/gestión)',
        '',
        '*Total: $ 139.000*',
        'Abonado: $ 50.000',
        '*Saldo: $ 89.000*',
        '',
        'Estado: Comprado',
      ].join('\n'),
    )
  })

  it('una cotización invita a confirmar y no muestra estado', () => {
    const message = plain(
      buildOrderMessage({ ...caseA, status: 'cotizado', paidCop: 0, balanceCop: 139_000 }),
    )
    expect(message).toMatch(/^Hola María, esta es la cotización de tu pedido del 22\/10\/2026:/)
    expect(message).not.toContain('Abonado')
    expect(message).not.toContain('Estado:')
    expect(message).toMatch(/me confirmas para hacer la compra\.$/)
  })

  it('un pedido pagado lo dice en vez del saldo', () => {
    const message = plain(buildOrderMessage({ ...caseA, paidCop: 139_000, balanceCop: 0 }))
    expect(message).toContain('*Pagado* ✓')
    expect(message).not.toContain('Saldo')
  })

  it('no suma el envío aparte: ya va en el valor de cada producto', () => {
    expect(buildOrderMessage(caseA)).not.toContain('Envío y gestión')
    const message = buildOrderMessage({
      ...caseA,
      items: [{ qty: 1, description: 'Oreo BTS', priceCop: 20_000, shippingChargedCop: 0 }],
    })
    expect(message).not.toContain('envío')
  })
})

// Cajas de envío: estado, códigos y textos. Los números (productos, cobrado, diferencia)
// salen de la vista v_shipments, igual que en la hoja "Control de envíos".

// Ganancia de envío de una caja = lo cobrado de envío a los clientes de sus productos − costo del envío.

import { formatDate, parseCop, parseDecimal } from './format'

/** En camino hasta que se marca la llegada; al llegar, su inventario pasa a disponible. */
export type ShipmentState = 'en_camino' | 'llego'

export const shipmentStateLabel: Record<ShipmentState, string> = {
  en_camino: 'En camino',
  llego: 'Llegó',
}

export const shipmentStateClass: Record<ShipmentState, string> = {
  en_camino: 'bg-amber-100 text-amber-900',
  llego: 'bg-emerald-100 text-emerald-900',
}

const CODE_PATTERN = /^ENV-(\d+)$/i

/** Siguiente código "ENV-###" después del mayor que ya existe. */
export function nextShipmentCode(codes: string[]): string {
  const max = codes.reduce((highest, code) => {
    const match = CODE_PATTERN.exec(code.trim())
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `ENV-${String(max + 1).padStart(3, '0')}`
}

type ShipmentDates = {
  carrier: string | null
  shippedOn: string | null
  expectedOn: string | null
  arrivedOn: string | null
}

/** "Courier · despachada 20/10/2026 · llega aprox. 31/10/2026" o "· llegó 30/10/2026". */
export function shipmentSubtitle(shipment: ShipmentDates): string {
  return [
    shipment.carrier,
    shipment.shippedOn && `despachada ${formatDate(shipment.shippedOn)}`,
    shipment.arrivedOn
      ? `llegó ${formatDate(shipment.arrivedOn)}`
      : shipment.expectedOn && `llega aprox. ${formatDate(shipment.expectedOn)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

export type ShipmentFormText = {
  code: string
  carrier: string
  shippedOn: string
  expectedOn: string
  realCost: string
  notes: string
}

/** Lo escrito en el formulario de caja a lo que se guarda ('' = vacío, código en mayúsculas). */
export function shipmentFields(values: ShipmentFormText) {
  return {
    code: values.code.trim().toUpperCase(),
    carrier: values.carrier.trim() || null,
    shippedOn: values.shippedOn || null,
    expectedOn: values.expectedOn || null,
    realCostCop: parseCop(values.realCost),
    notes: values.notes.trim() || null,
  }
}

/** Filas de "Productos para el inventario" de una caja nueva, listas para create_shipment (las vacías se ignoran). */
export function boxStockFromRows(
  rows: { productId: string | null; productName: string; qty: string; usd: string }[],
): { productId: string | null; productName: string; qty: number; unitCostUsd: number | null }[] {
  return rows
    .filter((row) => row.productName.trim() !== '')
    .map((row) => ({
      productId: row.productId,
      productName: row.productName.trim(),
      qty: parseDecimal(row.qty) ?? 1,
      unitCostUsd: parseDecimal(row.usd),
    }))
}

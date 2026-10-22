// Cajas de envío: estado, códigos y textos. Los números (productos, cobrado, diferencia)
// salen de la vista v_shipments, igual que en la hoja "Control de envíos".

import { formatDate } from './format'

export type ShipmentState = 'por_cerrar' | 'cerrada'

export const shipmentStateLabel: Record<ShipmentState, string> = {
  por_cerrar: 'Por cerrar',
  cerrada: 'Cerrada',
}

export const shipmentStateClass: Record<ShipmentState, string> = {
  por_cerrar: 'bg-amber-100 text-amber-900',
  cerrada: 'bg-emerald-100 text-emerald-900',
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

/** "Courier · llegó 22/10/2026" */
export function shipmentSubtitle(shipment: { carrier: string | null; arrivedOn: string | null }): string {
  return [shipment.carrier, shipment.arrivedOn ? `llegó ${formatDate(shipment.arrivedOn)}` : 'sin fecha de llegada']
    .filter(Boolean)
    .join(' · ')
}

/** Lo escrito en el formulario de caja a lo que se guarda ('' = vacío, código en mayúsculas). */
export function shipmentFields(values: { code: string; carrier: string; arrivedOn: string; notes: string }) {
  return {
    code: values.code.trim().toUpperCase(),
    carrier: values.carrier.trim() || null,
    arrivedOn: values.arrivedOn || null,
    notes: values.notes.trim() || null,
  }
}

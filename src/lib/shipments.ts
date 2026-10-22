// Cajas de envío: estado y códigos. Los números (productos, cobrado, diferencia)
// salen de la vista v_shipments, igual que en la hoja "Control de envíos".

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

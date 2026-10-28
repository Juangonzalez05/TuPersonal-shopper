// Los CSV de respaldo: pedidos, productos vendidos (como la hoja "Productos y ventas"),
// cajas (como "Control de envíos") y flujo de caja. Fechas dd/MM/yyyy y pesos sin puntos de miles.

import type { CashEntry } from '@/api/cash'
import type { OrderLineExport, OrderSummary } from '@/api/orders'
import type { Shipment } from '@/api/shipments'
import { cashSourceLabel, isIncome } from './cash-flow'
import { csvDecimal, csvPercent, toCsv } from './csv'
import { formatDate } from './format'
import { deliveryStatusLabel, paymentStatusLabel } from './order-labels'
import { shipmentStateLabel } from './shipments'

export function ordersCsv(orders: OrderSummary[]): string {
  return toCsv(
    [
      'Fecha',
      'Cliente',
      'WhatsApp',
      'Estado de entrega',
      'Estado de pago',
      'Productos (COP)',
      'Envío cobrado (COP)',
      'Total (COP)',
      'Costo (COP)',
      'Ganancia productos (COP)',
      'Abonado (COP)',
      'Saldo (COP)',
      'Líneas incompletas',
      'Notas',
    ],
    orders.map((o) => [
      formatDate(o.orderedOn),
      o.customerName,
      o.customerPhone,
      deliveryStatusLabel[o.status],
      paymentStatusLabel[o.paymentStatus],
      o.itemsPriceCop,
      o.shippingChargedCop,
      o.totalCop,
      o.itemsCostCop,
      o.itemsProfitCop,
      o.paidCop,
      o.balanceCop,
      o.incompleteItems,
      o.notes,
    ]),
  )
}

export function orderLinesCsv(lines: OrderLineExport[]): string {
  return toCsv(
    [
      'Fecha',
      'Cliente',
      'Producto',
      'Cantidad',
      'Costo USD (c/u)',
      'TRM',
      'Costo total (COP)',
      '% de incremento',
      'Precio del producto sin envío (COP)',
      'Envío incluido (COP)',
      'Total cobrado (COP)',
      'Código de caja',
      'Sale del inventario',
      'Incompleta',
      'Estado del pedido',
    ],
    lines.map((l) => [
      formatDate(l.orderedOn),
      l.customerName,
      l.description,
      l.qty,
      csvDecimal(l.unitCostUsd),
      csvDecimal(l.trm),
      l.costCop,
      csvPercent(l.markupPct),
      l.priceCop,
      l.shippingChargedCop,
      l.priceCop + l.shippingChargedCop,
      l.shipmentCode,
      l.fromStock,
      l.incomplete,
      deliveryStatusLabel[l.orderStatus],
    ]),
  )
}

export function shipmentsCsv(shipments: Shipment[]): string {
  return toCsv(
    [
      'Código de caja',
      'Courier',
      'Despacho',
      'Llegada estimada',
      'Llegada real',
      'Estado',
      'Productos en la caja',
      'Unidades de pedidos',
      'Unidades para inventario',
      'Costo del envío (COP)',
      'Costo por producto (COP)',
      'Envío cobrado a los pedidos (COP)',
      'Lo que les tocó de la caja (COP)',
      'Ganancia de envíos (COP)',
      'Parte de inventario / otros (COP)',
      'Notas',
    ],
    shipments.map((s) => [
      s.code,
      s.carrier,
      s.shippedOn ? formatDate(s.shippedOn) : null,
      s.expectedOn ? formatDate(s.expectedOn) : null,
      s.arrivedOn ? formatDate(s.arrivedOn) : null,
      shipmentStateLabel[s.state],
      s.unitsTotal > 0 ? s.unitsTotal : null,
      s.clientUnits,
      s.stockUnits,
      s.realCostCop,
      s.costPerUnitCop,
      s.chargedCop,
      s.clientsRealCop,
      s.differenceCop,
      s.otherRealCop,
      s.notes,
    ]),
  )
}

/** Flujo de caja: el valor lleva el signo (+ entra, − sale) para sumarlo directo en Excel. */
export function cashFlowCsv(entries: CashEntry[]): string {
  return toCsv(
    ['Fecha', 'Tipo', 'Entra o sale', 'Valor (COP)', 'Cliente o caja', 'Medio', 'Nota'],
    entries.map((e) => [
      formatDate(e.movedOn),
      cashSourceLabel[e.source],
      isIncome(e.source) ? 'Entra' : 'Sale',
      e.signedCop,
      e.label,
      e.method,
      e.note,
    ]),
  )
}

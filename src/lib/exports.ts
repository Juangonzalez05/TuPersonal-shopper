// Los tres CSV de respaldo: pedidos, productos vendidos (como la hoja "Productos y ventas")
// y cajas (como "Control de envíos"). Fechas dd/MM/yyyy y pesos sin puntos de miles.

import type { OrderLineExport, OrderSummary } from '@/api/orders'
import type { Shipment } from '@/api/shipments'
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
      'Precio al público (COP)',
      'Envío cobrado (COP)',
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
      'Productos de clientes',
      'Unidades para inventario',
      'Envío cobrado a clientes (COP)',
      'Costo del envío (COP)',
      'Ganancia de envío (COP)',
      'Notas',
    ],
    shipments.map((s) => [
      s.code,
      s.carrier,
      s.shippedOn ? formatDate(s.shippedOn) : null,
      s.expectedOn ? formatDate(s.expectedOn) : null,
      s.arrivedOn ? formatDate(s.arrivedOn) : null,
      shipmentStateLabel[s.state],
      s.itemsCount,
      s.stockUnits,
      s.chargedCop,
      s.realCostCop,
      s.differenceCop,
      s.notes,
    ]),
  )
}

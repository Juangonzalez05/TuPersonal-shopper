// Resumen: los mismos renglones y fórmulas de la hoja "Resumen" del Excel, calculados
// sobre las vistas (v_orders, v_shipments, v_stock) y filtrados por mes.
//
// Diferencias a propósito con el Excel:
//  - Solo cuentan pedidos Confirmado en adelante: una cotización no se factura y un
//    anulado no existe. Las cotizaciones se cuentan aparte.
//  - Los estados se cuentan por pedido (el Excel contaba filas de producto) y "Canceladas"
//    se llama "Pagados".

import type { OrderSummary } from '@/api/orders'
import type { BoxItem, Shipment } from '@/api/shipments'
import type { StockItem } from '@/api/stock'
import { todayBogota } from './format'

export type SummaryData = {
  orders: OrderSummary[]
  shipments: Shipment[]
  /** Líneas sin caja de pedidos que se pueden meter a una caja (useUnboxedItems). */
  unboxed: BoxItem[]
  stock: StockItem[]
}

export type Summary = {
  /** LO QUE COBRO */
  billing: { productsCop: number; shippingCop: number; totalCop: number; paidCop: number; balanceCop: number }
  /** LO QUE ME CUESTA */
  costs: { productsCop: number; closedShipmentsCop: number }
  /** MI GANANCIA */
  profit: { productsCop: number; shippingCop: number; totalCop: number }
  /** ESTADO DE LAS VENTAS */
  sales: { pendiente: number; separado: number; pagado: number; incomplete: number; quotes: number }
  /** CAJAS DE ENVÍO */
  shipments: { closed: number; open: number; unboxedShippingCop: number }
  /** INVENTARIO (foto de hoy) */
  stock: { products: number; availableUnits: number; soldOut: number; toReview: number }
}

/** "2026-10-22" → "2026-10" */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7)

/** Mes de una caja: el de llegada o, si aún no tiene, el de creación en hora de Bogotá. */
export const shipmentMonth = (shipment: Shipment) =>
  monthOf(shipment.arrivedOn ?? todayBogota(new Date(shipment.createdAt)))

const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0)

export function buildSummary(data: SummaryData, month: string | null): Summary {
  const inMonth = (isoDate: string) => month === null || monthOf(isoDate) === month

  const monthOrders = data.orders.filter((o) => inMonth(o.orderedOn))
  const orders = monthOrders.filter((o) => o.status !== 'cotizado' && o.status !== 'anulado')
  const shipments = data.shipments.filter((s) => month === null || shipmentMonth(s) === month)
  const closed = shipments.filter((s) => s.state === 'cerrada')

  const productsCop = sum(orders, (o) => o.itemsPriceCop)
  const shippingCop = sum(orders, (o) => o.shippingChargedCop)
  const productsProfit = sum(orders, (o) => o.itemsProfitCop)
  const shippingProfit = sum(closed, (s) => s.differenceCop ?? 0)

  return {
    billing: {
      productsCop,
      shippingCop,
      totalCop: productsCop + shippingCop,
      paidCop: sum(orders, (o) => o.paidCop),
      balanceCop: sum(orders, (o) => o.balanceCop),
    },
    costs: {
      productsCop: sum(orders, (o) => o.itemsCostCop),
      closedShipmentsCop: sum(closed, (s) => s.realCostCop ?? 0),
    },
    profit: {
      productsCop: productsProfit,
      shippingCop: shippingProfit,
      totalCop: productsProfit + shippingProfit,
    },
    sales: {
      pendiente: orders.filter((o) => o.paymentStatus === 'pendiente').length,
      separado: orders.filter((o) => o.paymentStatus === 'separado').length,
      pagado: orders.filter((o) => o.paymentStatus === 'pagado').length,
      incomplete: orders.filter((o) => o.incompleteItems > 0).length,
      quotes: monthOrders.filter((o) => o.status === 'cotizado').length,
    },
    shipments: {
      closed: closed.length,
      open: shipments.filter((s) => s.state === 'por_cerrar').length,
      unboxedShippingCop: sum(
        data.unboxed.filter((item) => inMonth(item.orderedOn)),
        (item) => item.shippingChargedCop,
      ),
    },
    stock: {
      products: data.stock.length,
      availableUnits: sum(data.stock, (item) => Math.max(item.availableQty, 0)),
      soldOut: data.stock.filter((item) => item.state === 'agotado').length,
      toReview: data.stock.filter((item) => item.state === 'revisar').length,
    },
  }
}

/** Meses con pedidos o cajas, más el actual, del más reciente al más antiguo. */
export function monthOptions(orders: OrderSummary[], shipments: Shipment[], today: string): string[] {
  const months = new Set([monthOf(today), ...orders.map((o) => monthOf(o.orderedOn)), ...shipments.map(shipmentMonth)])
  return [...months].sort().reverse()
}

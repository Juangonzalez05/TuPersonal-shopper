// Resumen: los mismos renglones y fórmulas de la hoja "Resumen" del Excel, calculados
// sobre las vistas (v_orders, v_shipments, v_stock) y filtrados por mes.
//
// Diferencias a propósito con el Excel:
//  - Solo cuentan pedidos Confirmado en adelante: una cotización no se factura y un
//    anulado no existe. Las cotizaciones se cuentan aparte.
//  - Los estados se cuentan por pedido (el Excel contaba filas de producto) y "Canceladas"
//    se llama "Pagados".

import type { CashEntry } from '@/api/cash'
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
  /** shippingCostCop: costo del envío de las cajas que ya lo tienen. */
  costs: { productsCop: number; shippingCostCop: number }
  /** MI GANANCIA */
  profit: { productsCop: number; shippingCop: number; totalCop: number }
  /** ESTADO DE LAS VENTAS */
  sales: { pendiente: number; separado: number; pagado: number; incomplete: number; quotes: number }
  /** CAJAS DE ENVÍO */
  shipments: { arrived: number; inTransit: number; withoutCost: number; unboxedShippingCop: number }
  /** INVENTARIO (foto de hoy) */
  stock: { products: number; availableUnits: number; inTransitUnits: number; soldOut: number; toReview: number }
}

/** "2026-10-22" → "2026-10" */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7)

/** Mes de una caja: el de llegada, si no el de despacho, y si no el de creación en hora de Bogotá. */
export const shipmentMonth = (shipment: Shipment) =>
  monthOf(shipment.arrivedOn ?? shipment.shippedOn ?? todayBogota(new Date(shipment.createdAt)))

const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0)

export function buildSummary(data: SummaryData, month: string | null): Summary {
  const inMonth = (isoDate: string) => month === null || monthOf(isoDate) === month

  const monthOrders = data.orders.filter((o) => inMonth(o.orderedOn))
  const orders = monthOrders.filter((o) => o.status !== 'cotizado' && o.status !== 'anulado')
  const shipments = data.shipments.filter((s) => month === null || shipmentMonth(s) === month)
  // La ganancia de envío se puede calcular apenas la caja tiene costo, llegue o no.
  const withCost = shipments.filter((s) => s.realCostCop !== null)

  const productsCop = sum(orders, (o) => o.itemsPriceCop)
  const shippingCop = sum(orders, (o) => o.shippingChargedCop)
  const productsProfit = sum(orders, (o) => o.itemsProfitCop)
  const shippingProfit = sum(withCost, (s) => s.differenceCop ?? 0)

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
      shippingCostCop: sum(withCost, (s) => s.realCostCop ?? 0),
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
      arrived: shipments.filter((s) => s.state === 'llego').length,
      inTransit: shipments.filter((s) => s.state === 'en_camino').length,
      withoutCost: shipments.length - withCost.length,
      unboxedShippingCop: sum(
        data.unboxed.filter((item) => inMonth(item.orderedOn)),
        (item) => item.shippingChargedCop,
      ),
    },
    stock: {
      products: data.stock.length,
      availableUnits: sum(data.stock, (item) => Math.max(item.availableQty, 0)),
      inTransitUnits: sum(data.stock, (item) => item.inTransitQty),
      soldOut: data.stock.filter((item) => item.state === 'agotado').length,
      toReview: data.stock.filter((item) => item.state === 'revisar').length,
    },
  }
}

/** Meses con pedidos, cajas o movimientos de plata, más el actual, del más reciente al más antiguo. */
export function monthOptions(
  orders: OrderSummary[],
  shipments: Shipment[],
  today: string,
  cash: CashEntry[] = [],
): string[] {
  const months = new Set([
    monthOf(today),
    ...orders.map((o) => monthOf(o.orderedOn)),
    ...shipments.map(shipmentMonth),
    ...cash.map((entry) => monthOf(entry.movedOn)),
  ])
  return [...months].sort().reverse()
}

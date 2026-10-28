// Resumen: los mismos renglones y fórmulas de la hoja "Resumen" del Excel, calculados
// sobre las vistas (v_orders, v_shipments, v_stock) y filtrados por mes.
//
// Diferencias a propósito con el Excel:
//  - Solo cuentan pedidos Confirmado en adelante: una cotización no se factura y un
//    anulado no existe. Las cotizaciones se cuentan aparte.
//  - Los estados se cuentan por pedido (el Excel contaba filas de producto) y "Canceladas"
//    se llama "Pagados".
//  - La ganancia de envíos es por producto: el costo de cada caja se divide entre los productos
//    que trae (v_shipments) y se compara con el envío cobrado a los pedidos que van en ella.
//  - Las ventas del inventario no llegaron en una caja registrada: su envío real se estima con
//    el costo por producto promedio de las cajas (solo las que tienen envío cobrado).

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
  /** GANANCIA DE ENVÍOS */
  shipping: {
    /** Pedidos en cajas del mes que ya se pueden comparar (con costo y productos). */
    boxesChargedCop: number
    boxesRealCop: number
    boxesProfitCop: number
    /** Ventas del inventario con envío cobrado (mes del pedido), contra el promedio de las cajas. */
    stockChargedCop: number
    stockUnits: number
    /** Costo por producto promedio de todas las cajas comparables; null si aún no hay. */
    avgCostPerUnitCop: number | null
    /** promedio × unidades; null si aún no hay promedio. */
    stockEstimatedCop: number | null
    /** Ganancia estimada: cobrado − estimado (0 sin promedio). */
    stockProfitCop: number
    /** Parte de las cajas que no es de pedidos (inventario / otros): costo, no se compara. */
    inventoryShareCop: number
    /** Envío cobrado de pedidos que aún no tienen caja (mes del pedido). */
    unboxedCop: number
    /** Envío cobrado en cajas del mes sin costo o sin productos. */
    uncomparedBoxesCop: number
  }
  /** CAJAS DEL MES */
  shipments: { boxes: Shipment[]; arrived: number; inTransit: number; withoutCost: number; withoutProducts: number }
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
  const withCost = shipments.filter((s) => s.realCostCop !== null)
  // La comparativa sale apenas la caja tiene costo y productos, llegue o no.
  const compared = shipments.filter((s) => s.differenceCop !== null)

  const productsCop = sum(orders, (o) => o.itemsPriceCop)
  const shippingCop = sum(orders, (o) => o.shippingChargedCop)
  const productsProfit = sum(orders, (o) => o.itemsProfitCop)
  const boxesProfit = sum(compared, (s) => s.differenceCop ?? 0)

  // Promedio de todas las cajas (no solo las del mes): el inventario puede venir de cualquiera.
  const allCompared = data.shipments.filter((s) => s.differenceCop !== null && s.unitsTotal > 0)
  const allUnits = sum(allCompared, (s) => s.unitsTotal)
  const avgCostPerUnitCop =
    allUnits > 0 ? Math.round(sum(allCompared, (s) => s.realCostCop ?? 0) / allUnits) : null
  const stockChargedCop = sum(orders, (o) => o.stockShippingCop)
  const stockUnits = sum(orders, (o) => o.stockShippingUnits)
  const stockEstimatedCop = avgCostPerUnitCop === null ? null : avgCostPerUnitCop * stockUnits
  const stockProfit = stockEstimatedCop === null ? 0 : stockChargedCop - stockEstimatedCop
  const shippingProfit = boxesProfit + stockProfit

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
    shipping: {
      boxesChargedCop: sum(compared, (s) => s.chargedCop),
      boxesRealCop: sum(compared, (s) => s.clientsRealCop ?? 0),
      boxesProfitCop: boxesProfit,
      stockChargedCop,
      stockUnits,
      avgCostPerUnitCop,
      stockEstimatedCop,
      stockProfitCop: stockProfit,
      inventoryShareCop: sum(compared, (s) => s.otherRealCop ?? 0),
      unboxedCop: sum(
        data.unboxed.filter((item) => inMonth(item.orderedOn)),
        (item) => item.shippingChargedCop,
      ),
      uncomparedBoxesCop: sum(
        shipments.filter((s) => s.differenceCop === null),
        (s) => s.chargedCop,
      ),
    },
    shipments: {
      boxes: shipments,
      arrived: shipments.filter((s) => s.state === 'llego').length,
      inTransit: shipments.filter((s) => s.state === 'en_camino').length,
      withoutCost: shipments.length - withCost.length,
      withoutProducts: withCost.filter((s) => s.unitsTotal === 0).length,
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

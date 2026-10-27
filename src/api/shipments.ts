import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cashKeys } from '@/api/cash'
import { fetchAll } from '@/api/fetch-all'
import { orderKeys } from '@/api/orders'
import { stockKeys } from '@/api/stock'
import { ASSIGNABLE_STATUSES, isDeliveryStatus, type DeliveryStatus } from '@/lib/order-labels'
import type { ShipmentState } from '@/lib/shipments'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export const shipmentKeys = {
  all: ['shipments'] as const,
  list: ['shipments', 'list'] as const,
  detail: (id: string) => ['shipments', 'detail', id] as const,
  unboxed: ['shipments', 'unboxed'] as const,
}

// ---------- Tipos limpios ----------

export type Shipment = {
  id: string
  code: string
  carrier: string | null
  /** Fecha de despacho. */
  shippedOn: string | null
  /** Llegada estimada. */
  expectedOn: string | null
  /** Llegada real; null = en camino. */
  arrivedOn: string | null
  /** Costo del envío; null = aún no se sabe. */
  realCostCop: number | null
  notes: string | null
  /** Líneas de pedidos no anulados (como el COUNTIF del Excel). */
  itemsCount: number
  chargedCop: number
  state: ShipmentState
  /** Ganancia de envío: cobrado − costo del envío; null mientras no hay costo. */
  differenceCop: number | null
  /** Unidades de inventario que trae. */
  stockUnits: number
  /** Momento de creación (ISO); define el mes de una caja que aún no tiene llegada. */
  createdAt: string
}

/** Línea de pedido vista desde las cajas. */
export type BoxItem = {
  id: string
  description: string
  qty: number
  shippingChargedCop: number
  orderId: string
  orderStatus: DeliveryStatus
  orderedOn: string
  customerName: string
}

/** Producto de inventario que trae la caja (un movimiento de ingreso). */
export type BoxStock = {
  movementId: string
  productId: string
  productName: string
  qty: number
  unitCostUsd: number | null
}

export type ShipmentDetail = Shipment & { items: BoxItem[]; stock: BoxStock[] }

type BoxStockRow = {
  id: string
  product_id: string
  qty: number
  unit_cost_usd: number | null
  product: { name: string } | null
}

type ShipmentRow = Database['public']['Views']['v_shipments']['Row']

const ITEM_SELECT =
  'id, description, qty, shipping_charged_cop, order:orders!inner(id, status, ordered_on, customer:customers(name))'

type BoxItemRow = {
  id: string
  description: string
  qty: number
  shipping_charged_cop: number
  order: { id: string; status: string; ordered_on: string; customer: { name: string } | null }
}

function toShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id!,
    code: row.code ?? '',
    carrier: row.carrier,
    shippedOn: row.shipped_on,
    expectedOn: row.expected_on,
    arrivedOn: row.arrived_on,
    realCostCop: row.real_cost_cop,
    notes: row.notes,
    itemsCount: row.items_count ?? 0,
    chargedCop: row.charged_cop ?? 0,
    state: row.state === 'llego' ? 'llego' : 'en_camino',
    differenceCop: row.difference_cop,
    stockUnits: row.stock_units ?? 0,
    createdAt: row.created_at ?? '',
  }
}

function toBoxItem(row: BoxItemRow): BoxItem {
  return {
    id: row.id,
    description: row.description,
    qty: row.qty,
    shippingChargedCop: row.shipping_charged_cop,
    orderId: row.order.id,
    orderStatus: isDeliveryStatus(row.order.status) ? row.order.status : 'confirmado',
    orderedOn: row.order.ordered_on,
    customerName: row.order.customer?.name ?? '—',
  }
}

// ---------- Consultas ----------

export function useShipments() {
  return useQuery({
    queryKey: shipmentKeys.list,
    queryFn: async () => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from('v_shipments')
          .select('*')
          .order('arrived_on', { ascending: false, nullsFirst: true })
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to),
      )
      // Primero las que vienen en camino; el orden de arriba se conserva dentro de cada grupo.
      return rows
        .map(toShipment)
        .sort((a, b) => Number(a.state === 'llego') - Number(b.state === 'llego'))
    },
  })
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: shipmentKeys.detail(id),
    queryFn: async (): Promise<ShipmentDetail | null> => {
      const [shipment, items, stock] = await Promise.all([
        supabase.from('v_shipments').select('*').eq('id', id).maybeSingle(),
        supabase.from('order_items').select(ITEM_SELECT).eq('shipment_id', id).order('created_at'),
        supabase
          .from('stock_movements')
          .select('id, product_id, qty, unit_cost_usd, product:products(name)')
          .eq('shipment_id', id)
          .order('created_at'),
      ])
      if (shipment.error) throw shipment.error
      if (items.error) throw items.error
      if (stock.error) throw stock.error
      if (!shipment.data) return null
      return {
        ...toShipment(shipment.data),
        items: (items.data as BoxItemRow[]).map(toBoxItem),
        stock: (stock.data as BoxStockRow[]).map((m) => ({
          movementId: m.id,
          productId: m.product_id,
          productName: m.product?.name ?? '—',
          qty: m.qty,
          unitCostUsd: m.unit_cost_usd,
        })),
      }
    },
  })
}

/** Líneas que se pueden meter a una caja y aún no tienen ninguna. */
export function useUnboxedItems() {
  return useQuery({
    queryKey: shipmentKeys.unboxed,
    queryFn: async () => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from('order_items')
          .select(ITEM_SELECT)
          .is('shipment_id', null)
          .eq('from_stock', false)
          .in('order.status', [...ASSIGNABLE_STATUSES])
          .order('created_at')
          .order('id')
          .range(from, to),
      )
      return (rows as BoxItemRow[]).map(toBoxItem)
    },
  })
}

// ---------- Cambios ----------

export type ShipmentFields = {
  code?: string
  carrier?: string | null
  shippedOn?: string | null
  expectedOn?: string | null
  /** null = aún en camino. */
  arrivedOn?: string | null
  /** null = costo del envío aún desconocido. */
  realCostCop?: number | null
  notes?: string | null
}

const toColumns = (fields: ShipmentFields) => ({
  code: fields.code,
  carrier: fields.carrier,
  shipped_on: fields.shippedOn,
  expected_on: fields.expectedOn,
  arrived_on: fields.arrivedOn,
  real_cost_cop: fields.realCostCop,
  notes: fields.notes,
})

function useInvalidateShipments() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: shipmentKeys.all })
    // El detalle del pedido muestra la caja de cada línea y el inventario cuenta lo que viene en camino.
    void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    void queryClient.invalidateQueries({ queryKey: stockKeys.all })
    // El costo del envío de cada caja sale solo en el flujo de caja.
    void queryClient.invalidateQueries({ queryKey: cashKeys.all })
  }
}

/** Producto que trae una caja nueva: del catálogo (productId) o nuevo (solo nombre). */
export type NewBoxStock = { productId: string | null; productName: string; qty: number; unitCostUsd: number | null }

/** Crea la caja y, en la misma transacción, el ingreso al inventario de lo que trae. */
export function useCreateShipment() {
  const invalidate = useInvalidateShipments()
  return useMutation({
    mutationFn: async ({ stock, ...fields }: ShipmentFields & { code: string; stock: NewBoxStock[] }) => {
      const { data, error } = await supabase.rpc('create_shipment', {
        p_code: fields.code,
        p_carrier: fields.carrier ?? undefined,
        p_shipped_on: fields.shippedOn ?? undefined,
        p_expected_on: fields.expectedOn ?? undefined,
        p_real_cost_cop: fields.realCostCop ?? undefined,
        p_notes: fields.notes ?? undefined,
        p_stock: stock.map((item) => ({
          product_id: item.productId,
          product_name: item.productName,
          qty: item.qty,
          unit_cost_usd: item.unitCostUsd,
        })),
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateShipment(id: string) {
  const invalidate = useInvalidateShipments()
  return useMutation({
    mutationFn: async (fields: ShipmentFields) => {
      const { error } = await supabase.from('shipments').update(toColumns(fields)).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteShipment() {
  const invalidate = useInvalidateShipments()
  return useMutation({
    mutationFn: async (id: string) => {
      // El inventario que traía la caja se va con ella; sus líneas de pedido quedan sin caja.
      const movements = await supabase.from('stock_movements').delete().eq('shipment_id', id)
      if (movements.error) throw movements.error
      const { error } = await supabase.from('shipments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useAssignItems(shipmentId: string) {
  const invalidate = useInvalidateShipments()
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { error } = await supabase.from('order_items').update({ shipment_id: shipmentId }).in('id', itemIds)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUnassignItem() {
  const invalidate = useInvalidateShipments()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('order_items').update({ shipment_id: null }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

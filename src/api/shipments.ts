import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderKeys } from '@/api/orders'
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
  arrivedOn: string | null
  realCostCop: number | null
  notes: string | null
  /** Líneas de pedidos no anulados (como el COUNTIF del Excel). */
  itemsCount: number
  chargedCop: number
  state: ShipmentState
  /** cobrado − costo real; null mientras está por cerrar. */
  differenceCop: number | null
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

export type ShipmentDetail = Shipment & { items: BoxItem[] }

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
    arrivedOn: row.arrived_on,
    realCostCop: row.real_cost_cop,
    notes: row.notes,
    itemsCount: row.items_count ?? 0,
    chargedCop: row.charged_cop ?? 0,
    state: row.state === 'cerrada' ? 'cerrada' : 'por_cerrar',
    differenceCop: row.difference_cop,
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
      const { data, error } = await supabase
        .from('v_shipments')
        .select('*')
        .order('arrived_on', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      // Primero las que faltan por cerrar; el orden de arriba se conserva dentro de cada grupo.
      return data
        .map(toShipment)
        .sort((a, b) => Number(a.state === 'cerrada') - Number(b.state === 'cerrada'))
    },
  })
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: shipmentKeys.detail(id),
    queryFn: async (): Promise<ShipmentDetail | null> => {
      const [shipment, items] = await Promise.all([
        supabase.from('v_shipments').select('*').eq('id', id).maybeSingle(),
        supabase.from('order_items').select(ITEM_SELECT).eq('shipment_id', id).order('created_at'),
      ])
      if (shipment.error) throw shipment.error
      if (items.error) throw items.error
      if (!shipment.data) return null
      return { ...toShipment(shipment.data), items: (items.data as BoxItemRow[]).map(toBoxItem) }
    },
  })
}

/** Líneas que se pueden meter a una caja y aún no tienen ninguna. */
export function useUnboxedItems() {
  return useQuery({
    queryKey: shipmentKeys.unboxed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(ITEM_SELECT)
        .is('shipment_id', null)
        .eq('from_stock', false)
        .in('order.status', [...ASSIGNABLE_STATUSES])
        .order('created_at')
      if (error) throw error
      return (data as BoxItemRow[]).map(toBoxItem)
    },
  })
}

// ---------- Cambios ----------

export type ShipmentFields = {
  code?: string
  carrier?: string | null
  arrivedOn?: string | null
  /** null = reabrir la caja ("por cerrar"). */
  realCostCop?: number | null
  notes?: string | null
}

const toColumns = (fields: ShipmentFields) => ({
  code: fields.code,
  carrier: fields.carrier,
  arrived_on: fields.arrivedOn,
  real_cost_cop: fields.realCostCop,
  notes: fields.notes,
})

function useInvalidateShipments() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: shipmentKeys.all })
    // El detalle del pedido muestra la caja de cada línea.
    void queryClient.invalidateQueries({ queryKey: orderKeys.all })
  }
}

export function useCreateShipment() {
  const invalidate = useInvalidateShipments()
  return useMutation({
    mutationFn: async (fields: ShipmentFields & { code: string }) => {
      const { data, error } = await supabase
        .from('shipments')
        .insert({ ...toColumns(fields), code: fields.code })
        .select('id')
        .single()
      if (error) throw error
      return data.id
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
      // Sus líneas quedan sin caja (on delete set null).
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

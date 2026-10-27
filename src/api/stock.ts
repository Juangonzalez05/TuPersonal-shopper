import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAll } from '@/api/fetch-all'
import { isDeliveryStatus, type DeliveryStatus } from '@/lib/order-labels'
import { isStockState, type StockState } from '@/lib/stock'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export const stockKeys = {
  all: ['stock'] as const,
  list: ['stock', 'list'] as const,
  product: (id: string) => ['stock', 'product', id] as const,
  lastCosts: ['stock', 'last-costs'] as const,
}

// ---------- Tipos limpios ----------

export type StockItem = {
  productId: string
  name: string
  /** Ingresos + ajustes (sin caja o de cajas que ya llegaron). */
  enteredQty: number
  /** Lo que traen las cajas que aún no llegan. */
  inTransitQty: number
  /** Líneas "sale del inventario" de pedidos Confirmado en adelante. */
  soldQty: number
  availableQty: number
  state: StockState
}

export type StockMovement = {
  id: string
  kind: 'ingreso' | 'ajuste'
  qty: number
  unitCostUsd: number | null
  movedOn: string
  note: string | null
  shipmentId: string | null
  shipmentCode: string | null
  /** La caja aún no llega: esta mercancía está en camino. */
  inTransit: boolean
}

/** Una línea de pedido que sale del inventario. */
export type StockSale = {
  id: string
  qty: number
  orderId: string
  orderStatus: DeliveryStatus
  orderedOn: string
  customerName: string
}

export type ProductStock = StockItem & { movements: StockMovement[]; sales: StockSale[] }

type StockRow = Database['public']['Views']['v_stock']['Row']

type MovementRow = {
  id: string
  kind: string
  qty: number
  unit_cost_usd: number | null
  moved_on: string
  note: string | null
  shipment_id: string | null
  shipment: { code: string; arrived_on: string | null } | null
}

type SaleRow = {
  id: string
  qty: number
  order: { id: string; status: string; ordered_on: string; customer: { name: string } | null }
}

function toStockItem(row: StockRow): StockItem {
  return {
    productId: row.product_id!,
    name: row.name ?? '',
    enteredQty: row.entered_qty ?? 0,
    inTransitQty: row.in_transit_qty ?? 0,
    soldQty: row.sold_qty ?? 0,
    availableQty: row.available_qty ?? 0,
    state: isStockState(row.state) ? row.state : 'agotado',
  }
}

// ---------- Consultas ----------

export function useStock() {
  return useQuery({
    queryKey: stockKeys.list,
    queryFn: async () => {
      const rows = await fetchAll((from, to) =>
        supabase.from('v_stock').select('*').order('name').order('product_id').range(from, to),
      )
      return rows.map(toStockItem)
    },
  })
}

export function useProductStock(productId: string) {
  return useQuery({
    queryKey: stockKeys.product(productId),
    queryFn: async (): Promise<ProductStock | null> => {
      const [stock, movements, sales] = await Promise.all([
        supabase.from('v_stock').select('*').eq('product_id', productId).maybeSingle(),
        supabase
          .from('stock_movements')
          .select('id, kind, qty, unit_cost_usd, moved_on, note, shipment_id, shipment:shipments(code, arrived_on)')
          .eq('product_id', productId)
          .order('moved_on', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('order_items')
          .select('id, qty, order:orders!inner(id, status, ordered_on, customer:customers(name))')
          .eq('product_id', productId)
          .eq('from_stock', true)
          .order('created_at', { ascending: false }),
      ])
      if (stock.error) throw stock.error
      if (movements.error) throw movements.error
      if (sales.error) throw sales.error
      if (!stock.data) return null
      return {
        ...toStockItem(stock.data),
        movements: (movements.data as MovementRow[]).map((m) => ({
          id: m.id,
          kind: m.kind === 'ajuste' ? 'ajuste' : 'ingreso',
          qty: m.qty,
          unitCostUsd: m.unit_cost_usd,
          movedOn: m.moved_on,
          note: m.note,
          shipmentId: m.shipment_id,
          shipmentCode: m.shipment?.code ?? null,
          inTransit: m.shipment !== null && m.shipment.arrived_on === null,
        })),
        sales: (sales.data as SaleRow[]).map((s) => ({
          id: s.id,
          qty: s.qty,
          orderId: s.order.id,
          orderStatus: isDeliveryStatus(s.order.status) ? s.order.status : 'confirmado',
          orderedOn: s.order.ordered_on,
          customerName: s.order.customer?.name ?? '—',
        })),
      }
    },
  })
}

/** Último costo USD de ingreso por producto, para prellenar el pedido que sale del inventario. */
export function useLastStockCosts() {
  return useQuery({
    queryKey: stockKeys.lastCosts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('product_id, unit_cost_usd')
        .eq('kind', 'ingreso')
        .not('unit_cost_usd', 'is', null)
        .order('moved_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const costs = new Map<string, number>()
      for (const row of data) {
        if (row.unit_cost_usd !== null && !costs.has(row.product_id)) costs.set(row.product_id, row.unit_cost_usd)
      }
      return costs
    },
  })
}

// ---------- Cambios ----------

export type NewMovement = {
  productId: string
  kind: 'ingreso' | 'ajuste'
  /** Ingreso: positiva. Ajuste: con signo (negativa resta). */
  qty: number
  unitCostUsd: number | null
  shipmentId: string | null
  movedOn: string
  note: string | null
}

export function useCreateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (movement: NewMovement) => {
      const { error } = await supabase.from('stock_movements').insert({
        product_id: movement.productId,
        kind: movement.kind,
        qty: movement.qty,
        unit_cost_usd: movement.unitCostUsd,
        shipment_id: movement.shipmentId,
        moved_on: movement.movedOn,
        note: movement.note,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stockKeys.all }),
  })
}

export function useDeleteMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (movementId: string) => {
      const { error } = await supabase.from('stock_movements').delete().eq('id', movementId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stockKeys.all }),
  })
}

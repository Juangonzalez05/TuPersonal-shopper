import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { customerKeys } from '@/api/customers'
import { productKeys } from '@/api/products'
import { isDeliveryStatus, isPaymentStatus, type DeliveryStatus } from '@/lib/order-labels'
import type { PaymentStatus } from '@/lib/pricing'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export const orderKeys = {
  all: ['orders'] as const,
  list: ['orders', 'list'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  lastPricing: ['orders', 'last-pricing'] as const,
}

// ---------- Tipos limpios (las vistas devuelven todo como nullable) ----------

export type OrderSummary = {
  id: string
  customerId: string
  customerName: string
  customerPhone: string | null
  orderedOn: string
  status: DeliveryStatus
  notes: string | null
  itemsPriceCop: number
  itemsCostCop: number
  itemsProfitCop: number
  shippingChargedCop: number
  totalCop: number
  paidCop: number
  balanceCop: number
  paymentStatus: PaymentStatus
  incompleteItems: number
}

export type OrderItem = {
  id: string
  productId: string | null
  description: string
  qty: number
  unitCostUsd: number
  trm: number
  markupPct: number | null
  shippingChargedCop: number
  costCop: number
  priceCop: number
  profitCop: number
  incomplete: boolean
}

export type Payment = {
  id: string
  amountCop: number
  paidOn: string
  method: string | null
  note: string | null
}

export type OrderDetail = OrderSummary & { items: OrderItem[]; payments: Payment[] }

type OrderRow = Database['public']['Views']['v_orders']['Row'] & {
  customer: { name: string; phone: string | null } | null
}
type OrderItemRow = Database['public']['Views']['v_order_items']['Row']

const ORDER_SELECT = '*, customer:customers(name, phone)'

function toOrderSummary(row: OrderRow): OrderSummary {
  return {
    id: row.id!,
    customerId: row.customer_id!,
    customerName: row.customer?.name ?? '—',
    customerPhone: row.customer?.phone ?? null,
    orderedOn: row.ordered_on!,
    status: isDeliveryStatus(row.status) ? row.status : 'cotizado',
    notes: row.notes,
    itemsPriceCop: row.items_price_cop ?? 0,
    itemsCostCop: row.items_cost_cop ?? 0,
    itemsProfitCop: row.items_profit_cop ?? 0,
    shippingChargedCop: row.shipping_charged_cop ?? 0,
    totalCop: row.total_cop ?? 0,
    paidCop: row.paid_cop ?? 0,
    balanceCop: row.balance_cop ?? 0,
    paymentStatus: isPaymentStatus(row.payment_status) ? row.payment_status : 'pendiente',
    incompleteItems: row.incomplete_items ?? 0,
  }
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id!,
    productId: row.product_id,
    description: row.description ?? '',
    qty: row.qty ?? 0,
    unitCostUsd: row.unit_cost_usd ?? 0,
    trm: row.trm ?? 0,
    markupPct: row.markup_pct,
    shippingChargedCop: row.shipping_charged_cop ?? 0,
    costCop: row.cost_cop ?? 0,
    priceCop: row.price_cop ?? 0,
    profitCop: row.profit_cop ?? 0,
    incomplete: row.incomplete ?? false,
  }
}

// ---------- Consultas ----------

export function useOrders() {
  return useQuery({
    queryKey: orderKeys.list,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_orders')
        .select(ORDER_SELECT)
        .order('ordered_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as OrderRow[]).map(toOrderSummary)
    },
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async (): Promise<OrderDetail | null> => {
      const [order, items, payments] = await Promise.all([
        supabase.from('v_orders').select(ORDER_SELECT).eq('id', id).maybeSingle(),
        supabase.from('v_order_items').select('*').eq('order_id', id).order('created_at'),
        supabase
          .from('payments')
          .select('id, amount_cop, paid_on, method, note')
          .eq('order_id', id)
          .order('paid_on')
          .order('created_at'),
      ])
      if (order.error) throw order.error
      if (items.error) throw items.error
      if (payments.error) throw payments.error
      if (!order.data) return null
      return {
        ...toOrderSummary(order.data as OrderRow),
        items: items.data.map(toOrderItem),
        payments: payments.data.map((p) => ({
          id: p.id,
          amountCop: p.amount_cop,
          paidOn: p.paid_on,
          method: p.method,
          note: p.note,
        })),
      }
    },
  })
}

/** Última TRM y último % usados, para prellenar el formulario. */
export function useLastPricing() {
  return useQuery({
    queryKey: orderKeys.lastPricing,
    queryFn: async () => {
      const [trm, markup] = await Promise.all([
        supabase
          .from('order_items')
          .select('trm')
          .gt('trm', 0)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('order_items')
          .select('markup_pct')
          .not('markup_pct', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (trm.error) throw trm.error
      if (markup.error) throw markup.error
      return { trm: trm.data?.trm ?? null, markupPct: markup.data?.markup_pct ?? null }
    },
  })
}

// ---------- Cambios ----------

export type CreateOrderArgs = Database['public']['Functions']['create_order']['Args']

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: CreateOrderArgs) => {
      const { data, error } = await supabase.rpc('create_order', args)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (status: DeliveryStatus) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

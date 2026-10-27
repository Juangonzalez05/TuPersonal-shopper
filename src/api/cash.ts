import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAll } from '@/api/fetch-all'
import { isCashSource, type CashKind, type CashSource } from '@/lib/cash-flow'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export const cashKeys = {
  all: ['cash'] as const,
  flow: ['cash', 'flow'] as const,
  order: (orderId: string) => ['cash', 'order', orderId] as const,
}

// ---------- Tipos limpios ----------

/** Un renglón del flujo de caja: abono, envío de caja o movimiento anotado a mano. */
export type CashEntry = {
  id: string
  source: CashSource
  /** Siempre positivo; signedCop lleva el signo (+ entra, − sale). */
  amountCop: number
  signedCop: number
  movedOn: string
  orderId: string | null
  shipmentId: string | null
  /** Cliente del pedido o código de la caja. */
  label: string | null
  method: string | null
  note: string | null
  createdAt: string
}

/** Movimiento anotado a mano, como se guarda en cash_movements. */
export type CashMovement = {
  id: string
  kind: CashKind
  amountCop: number
  movedOn: string
  orderId: string | null
  method: string | null
  note: string | null
}

export type NewCashMovement = Omit<CashMovement, 'id'>

type CashRow = Database['public']['Views']['v_cash_flow']['Row']

function toCashEntry(row: CashRow): CashEntry | null {
  if (!isCashSource(row.source)) return null
  return {
    id: row.id!,
    source: row.source,
    amountCop: row.amount_cop ?? 0,
    signedCop: row.signed_cop ?? 0,
    movedOn: row.moved_on!,
    orderId: row.order_id,
    shipmentId: row.shipment_id,
    label: row.label,
    method: row.method,
    note: row.note,
    createdAt: row.created_at ?? '',
  }
}

const toEntries = (rows: CashRow[]) => rows.map(toCashEntry).filter((entry) => entry !== null)

// ---------- Consultas ----------

/** Todo el flujo de caja, del movimiento más nuevo al más viejo. */
export function useCashFlow() {
  return useQuery({
    queryKey: cashKeys.flow,
    queryFn: async () => {
      const rows = await fetchAll((from, to) =>
        supabase
          .from('v_cash_flow')
          .select('*')
          .order('moved_on', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to),
      )
      return toEntries(rows)
    },
  })
}

/** Compras (y demás movimientos anotados) vinculadas a un pedido. */
export function useOrderPurchases(orderId: string) {
  return useQuery({
    queryKey: cashKeys.order(orderId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_cash_flow')
        .select('*')
        .eq('order_id', orderId)
        .neq('source', 'abono')
        .order('moved_on')
        .order('created_at')
      if (error) throw error
      return toEntries(data)
    },
  })
}

// ---------- Cambios ----------

const toColumns = (movement: NewCashMovement) => ({
  kind: movement.kind,
  amount_cop: movement.amountCop,
  moved_on: movement.movedOn,
  order_id: movement.orderId,
  method: movement.method,
  note: movement.note,
})

function useInvalidateCash() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: cashKeys.all })
}

export function useAddCashMovement() {
  const invalidate = useInvalidateCash()
  return useMutation({
    mutationFn: async (movement: NewCashMovement) => {
      const { error } = await supabase.from('cash_movements').insert(toColumns(movement))
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateCashMovement() {
  const invalidate = useInvalidateCash()
  return useMutation({
    mutationFn: async ({ id, ...movement }: CashMovement) => {
      const { error } = await supabase.from('cash_movements').update(toColumns(movement)).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteCashMovement() {
  const invalidate = useInvalidateCash()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cash_movements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

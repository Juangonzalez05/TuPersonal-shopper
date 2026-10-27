import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cashKeys } from '@/api/cash'
import { orderKeys } from '@/api/orders'
import { supabase } from '@/lib/supabase'

export type NewPayment = {
  amountCop: number
  paidOn: string
  method: string | null
  note: string | null
}

function useInvalidatePayments() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    // Los abonos entran solos al flujo de caja.
    void queryClient.invalidateQueries({ queryKey: cashKeys.all })
  }
}

export function useAddPayment(orderId: string) {
  const invalidate = useInvalidatePayments()
  return useMutation({
    mutationFn: async (payment: NewPayment) => {
      const { error } = await supabase.from('payments').insert({
        order_id: orderId,
        amount_cop: payment.amountCop,
        paid_on: payment.paidOn,
        method: payment.method,
        note: payment.note,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeletePayment() {
  const invalidate = useInvalidatePayments()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdatePayment() {
  const invalidate = useInvalidatePayments()
  return useMutation({
    mutationFn: async ({ id, ...payment }: NewPayment & { id: string }) => {
      const { error } = await supabase
        .from('payments')
        .update({
          amount_cop: payment.amountCop,
          paid_on: payment.paidOn,
          method: payment.method,
          note: payment.note,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

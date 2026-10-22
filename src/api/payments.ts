import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orderKeys } from '@/api/orders'
import { supabase } from '@/lib/supabase'

export type NewPayment = {
  amountCop: number
  paidOn: string
  method: string | null
  note: string | null
}

export function useAddPayment(orderId: string) {
  const queryClient = useQueryClient()
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  })
}

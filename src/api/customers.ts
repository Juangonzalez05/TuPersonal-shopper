import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Customer = { id: string; name: string; phone: string | null }

export const customerKeys = { all: ['customers'] as const }

export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.all,
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase.from('customers').select('id, name, phone').order('name')
      if (error) throw error
      return data
    },
  })
}

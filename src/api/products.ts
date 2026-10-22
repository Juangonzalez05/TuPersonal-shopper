import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Product = { id: string; name: string; defaultMarkup: number | null }

export const productKeys = { all: ['products'] as const }

export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, default_markup')
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data.map((p) => ({ id: p.id, name: p.name, defaultMarkup: p.default_markup }))
    },
  })
}

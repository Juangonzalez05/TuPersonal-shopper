import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { stockKeys } from '@/api/stock'
import { normalizeProductName } from '@/lib/product-name'
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

/**
 * Crea un producto con el nombre normalizado (sin espacios sobrantes). Quien la llama
 * debe ofrecer primero los existentes con la misma llave (productKey); si aun así se
 * repite, la base lo rechaza por el índice único de nombre.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rawName: string): Promise<Product> => {
      const { data, error } = await supabase
        .from('products')
        .insert({ name: normalizeProductName(rawName) })
        .select('id, name, default_markup')
        .single()
      if (error) throw error
      return { id: data.id, name: data.name, defaultMarkup: data.default_markup }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: stockKeys.all })
    },
  })
}

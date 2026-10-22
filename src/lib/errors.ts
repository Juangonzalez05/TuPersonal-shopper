/** Mensaje legible de un error de Supabase/PostgREST o de JS. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Error desconocido'
}

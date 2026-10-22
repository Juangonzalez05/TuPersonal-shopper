/** Mensaje legible de un error de Supabase/PostgREST o de JS. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Error desconocido'
}

/** true si Postgres rechazó un valor repetido en una columna única (código 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505')
}

import { AlertTriangle, PackagePlus, Search } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useStock } from '@/api/stock'
import { StockMovementForm } from '@/components/stock/StockMovementForm'
import { StockRow } from '@/components/stock/StockRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/errors'
import { matchesQuery } from '@/lib/search'
import { isStockState, STOCK_STATES, stockStateLabel, type StockState } from '@/lib/stock'
import { cn } from '@/lib/utils'

// Los filtros viven en la URL para que se mantengan al volver del detalle.
const ALL = 'todos'
const chipLabel: Record<StockState, string> = { ...stockStateLabel, disponible: 'Disponibles', agotado: 'Agotados' }

export function InventarioPage() {
  const stock = useStock()
  const [params, setParams] = useSearchParams()
  const [registering, setRegistering] = useState(false)
  const query = params.get('q') ?? ''
  const stateParam = params.get('estado')
  const state = isStockState(stateParam) ? stateParam : ALL

  const setParam = (key: string, value: string, defaultValue: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === defaultValue) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  if (stock.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando inventario…</p>
  if (stock.isError) {
    return (
      <div className="grid gap-3 py-8 text-center">
        <p className="text-destructive">No se pudo cargar el inventario: {errorMessage(stock.error)}</p>
        <Button variant="outline" onClick={() => stock.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const toReview = stock.data.filter((item) => item.state === 'revisar').length
  const visible = stock.data.filter(
    (item) => matchesQuery(item.name, query) && (state === ALL || item.state === state),
  )
  const availableUnits = visible.reduce((sum, item) => sum + Math.max(item.availableQty, 0), 0)

  return (
    <div className="grid gap-3">
      {toReview > 0 && state !== 'revisar' && (
        <button
          type="button"
          onClick={() => setParam('estado', 'revisar', ALL)}
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-left font-medium text-red-950"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {toReview === 1 ? '1 producto por revisar' : `${toReview} productos por revisar`}
          <span className="font-normal">· vendido más de lo ingresado</span>
        </button>
      )}

      {registering ? (
        <StockMovementForm kind="ingreso" onDone={() => setRegistering(false)} />
      ) : (
        <Button size="lg" className="h-12 text-base" onClick={() => setRegistering(true)}>
          <PackagePlus />
          Registrar ingreso
        </Button>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          className="h-11 pl-9 text-base"
          value={query}
          onChange={(event) => setParam('q', event.target.value, '')}
        />
      </div>

      <div role="group" aria-label="Estado" className="flex gap-1.5 overflow-x-auto">
        {[ALL, ...STOCK_STATES].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={state === value}
            onClick={() => setParam('estado', value, ALL)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
              state === value ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {isStockState(value) ? chipLabel[value] : 'Todos'}
            {value === 'revisar' && toReview > 0 && ` (${toReview})`}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {visible.length === 1 ? '1 producto' : `${visible.length} productos`} · {availableUnits} unidades disponibles
      </p>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {stock.data.length === 0 ? 'Aún no hay productos en el inventario.' : 'Ningún producto coincide.'}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visible.map((item) => (
            <li key={item.productId}>
              <StockRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatCop } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Un bloque de la hoja Resumen: título en mayúsculas y renglones. */
export function SummaryCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-3">
      <h2 className="flex items-baseline justify-between gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
        {note && <span className="font-normal normal-case">{note}</span>}
      </h2>
      <dl className="mt-2 grid gap-1.5 text-sm">{children}</dl>
    </section>
  )
}

type SummaryRowProps = {
  label: string
  value: number
  /** Pesos (por defecto) o un conteo. */
  kind?: 'cop' | 'count'
  strong?: boolean
  /** Verde si es positivo, rojo si es negativo (ganancias). */
  signed?: boolean
  /** Lleva a la pantalla con el filtro puesto. */
  to?: string
}

export function SummaryRow({ label, value, kind = 'cop', strong, signed, to }: SummaryRowProps) {
  const content = (
    <>
      <dt className="min-w-0">{label}</dt>
      <dd
        className={cn(
          'flex shrink-0 items-center gap-1 tabular-nums',
          signed && value > 0 && 'text-emerald-700',
          signed && value < 0 && 'text-red-700',
        )}
      >
        {kind === 'cop' ? formatCop(value) : value}
        {to && <ChevronRight className="size-4 text-muted-foreground" />}
      </dd>
    </>
  )
  const className = cn('flex items-center justify-between gap-3', strong && 'border-t pt-1.5 text-base font-semibold')

  return to ? (
    <Link to={to} className={cn(className, 'rounded-sm hover:bg-muted/50')}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

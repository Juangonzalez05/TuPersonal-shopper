import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatCop } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Sección plegable del Resumen: cerrada por defecto, con el dato clave en el título.
 * Con rows, el contenido son renglones (SummaryRow); si no, cualquier contenido.
 */
export function SummarySection({
  title,
  preview,
  rows = true,
  children,
}: {
  title: string
  preview?: ReactNode
  rows?: boolean
  children: ReactNode
}) {
  return (
    <details className="group rounded-lg border">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{title}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
          {preview}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      {rows ? (
        <dl className="grid gap-1.5 border-t p-3 text-sm">{children}</dl>
      ) : (
        <div className="border-t p-3">{children}</div>
      )}
    </details>
  )
}

/** Subtítulo dentro de una sección del Resumen. */
export function SummaryGroup({ children }: { children: ReactNode }) {
  return <div className="pt-2 text-xs font-medium text-muted-foreground first:pt-0">{children}</div>
}

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

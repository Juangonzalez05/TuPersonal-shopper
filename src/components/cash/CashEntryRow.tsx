import {
  Banknote,
  ChevronRight,
  HandCoins,
  Package,
  Pencil,
  PiggyBank,
  Receipt,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { CashEntry } from '@/api/cash'
import { cashEntryText, isIncome, type CashSource } from '@/lib/cash-flow'
import { formatCop } from '@/lib/format'
import { cn } from '@/lib/utils'

const sourceIcon: Record<CashSource, LucideIcon> = {
  abono: HandCoins,
  aporte: PiggyBank,
  reinversion: ShoppingBag,
  envio: Package,
  gasto: Receipt,
  retiro: Banknote,
}

export function CashSourceIcon({ source, className }: { source: CashSource; className?: string }) {
  const Icon = sourceIcon[source]
  return <Icon className={className} />
}

/** Valor con signo: verde si entra, rojo si sale. */
export function CashAmount({ entry, className }: { entry: CashEntry; className?: string }) {
  const income = isIncome(entry.source)
  return (
    <span className={cn('shrink-0 font-medium tabular-nums', income ? 'text-emerald-700' : 'text-red-700', className)}>
      {income ? '+' : '−'}
      {formatCop(entry.amountCop)}
    </span>
  )
}

/**
 * Un renglón del flujo de caja. Un abono abre su pedido y un envío su caja (se corrigen allá);
 * lo anotado a mano llama a onEdit.
 */
export function CashEntryRow({ entry, onEdit }: { entry: CashEntry; onEdit: (entry: CashEntry) => void }) {
  const { title, detail } = cashEntryText(entry)
  const content: ReactNode = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isIncome(entry.source) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
        )}
      >
        <CashSourceIcon source={entry.source} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      <CashAmount entry={entry} />
    </>
  )
  const className = 'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted'

  if (entry.source === 'abono' && entry.orderId) {
    return (
      <Link to={`/pedidos/${entry.orderId}`} className={className}>
        {content}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    )
  }
  if (entry.source === 'envio' && entry.shipmentId) {
    return (
      <Link to={`/cajas/${entry.shipmentId}`} className={className}>
        {content}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    )
  }
  return (
    <button type="button" className={className} aria-label={`Corregir: ${title}`} onClick={() => onEdit(entry)}>
      {content}
      <Pencil className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

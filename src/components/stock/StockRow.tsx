import { Link } from 'react-router'
import type { StockItem } from '@/api/stock'
import { StockBadge } from '@/components/stock/StockBadge'
import { cn } from '@/lib/utils'

export function StockRow({ item }: { item: StockItem }) {
  return (
    <Link
      to={`/inventario/${item.productId}`}
      className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          ingresado {item.enteredQty} · vendido {item.soldQty}
          {item.inTransitQty > 0 && (
            <span className="font-medium text-amber-700">
              {' '}
              · +{item.inTransitQty} en camino
              {item.committedQty > 0 && ` (${item.committedQty} ya vendido${item.committedQty === 1 ? '' : 's'})`}
            </span>
          )}
        </p>
        <StockBadge state={item.state} />
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-2xl font-semibold tabular-nums',
            item.availableQty < 0 && 'text-red-700',
            item.availableQty === 0 && 'text-muted-foreground',
          )}
        >
          {item.availableQty}
        </p>
        <p className="text-xs text-muted-foreground">disp.</p>
      </div>
    </Link>
  )
}

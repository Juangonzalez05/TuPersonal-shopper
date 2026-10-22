import { Badge } from '@/components/ui/badge'
import { stockStateClass, stockStateLabel, type StockState } from '@/lib/stock'

export function StockBadge({ state }: { state: StockState }) {
  return <Badge className={stockStateClass[state]}>{stockStateLabel[state]}</Badge>
}

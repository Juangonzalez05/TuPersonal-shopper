import { Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CashEntry } from '@/api/cash'
import { fetchOrderLines, type OrderSummary } from '@/api/orders'
import type { Shipment } from '@/api/shipments'
import { Button } from '@/components/ui/button'
import { downloadCsv } from '@/lib/csv'
import { errorMessage } from '@/lib/errors'
import { cashFlowCsv, orderLinesCsv, ordersCsv, shipmentsCsv } from '@/lib/exports'
import { formatMonth, todayBogota } from '@/lib/format'
import { monthOf, shipmentMonth } from '@/lib/summary'

type ExportButtonsProps = {
  /** "yyyy-MM" o null para todos los meses (respaldo completo). */
  month: string | null
  orders: OrderSummary[]
  shipments: Shipment[]
  /** Flujo de caja, del movimiento más nuevo al más viejo. */
  cash: CashEntry[]
}

/** Respaldo en CSV del mes elegido. Incluye cotizaciones y anulados: es una copia de todo. */
export function ExportButtons({ month, orders, shipments, cash }: ExportButtonsProps) {
  const [loadingLines, setLoadingLines] = useState(false)
  const suffix = month ?? `todo-${todayBogota()}`
  const inMonth = (isoDate: string) => month === null || monthOf(isoDate) === month

  const exportOrders = () => {
    const rows = orders.filter((o) => inMonth(o.orderedOn)).toReversed()
    downloadCsv(`pedidos-${suffix}.csv`, ordersCsv(rows))
  }

  const exportLines = async () => {
    setLoadingLines(true)
    try {
      const lines = (await fetchOrderLines()).filter((line) => inMonth(line.orderedOn))
      downloadCsv(`productos-vendidos-${suffix}.csv`, orderLinesCsv(lines))
    } catch (error) {
      toast.error(`No se pudo exportar: ${errorMessage(error)}`)
    } finally {
      setLoadingLines(false)
    }
  }

  const exportShipments = () => {
    const rows = shipments.filter((s) => month === null || shipmentMonth(s) === month)
    downloadCsv(`cajas-${suffix}.csv`, shipmentsCsv(rows))
  }

  const exportCash = () => {
    const rows = cash.filter((entry) => inMonth(entry.movedOn)).toReversed()
    downloadCsv(`flujo-de-caja-${suffix}.csv`, cashFlowCsv(rows))
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        {month ? `CSV de ${formatMonth(month)}.` : 'CSV con todos los meses: el respaldo completo.'} Se abre en Excel.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11" onClick={exportOrders}>
          <Download />
          Pedidos
        </Button>
        <Button variant="outline" className="h-11 px-2" disabled={loadingLines} onClick={() => void exportLines()}>
          <Download />
          {loadingLines ? 'Bajando…' : 'Productos'}
        </Button>
        <Button variant="outline" className="h-11" onClick={exportShipments}>
          <Download />
          Cajas
        </Button>
        <Button variant="outline" className="h-11" onClick={exportCash}>
          <Download />
          Flujo de caja
        </Button>
      </div>
    </div>
  )
}

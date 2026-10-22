import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import type { BoxItem } from '@/api/shipments'
import { formatDate } from '@/lib/format'

/** Avisos de la pantalla Cajas: productos comprados sin caja y cajas por cerrar. */
export function ShipmentAlerts({ unboxedPurchased, openCount }: { unboxedPurchased: BoxItem[]; openCount: number }) {
  if (unboxedPurchased.length === 0 && openCount === 0) return null

  return (
    <div className="grid gap-2">
      {unboxedPurchased.length > 0 && (
        <details className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" />
            {unboxedPurchased.length === 1
              ? '1 producto comprado sin caja'
              : `${unboxedPurchased.length} productos comprados sin caja`}
          </summary>
          <p className="mt-2 text-sm">Su envío cobrado no está en ninguna caja. Agrégalos desde una caja.</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {unboxedPurchased.map((item) => (
              <li key={item.id}>
                <Link to={`/pedidos/${item.orderId}`} className="underline-offset-2 hover:underline">
                  {item.customerName} · {item.qty} × {item.description} · {formatDate(item.orderedOn)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {openCount > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 font-medium text-amber-950">
          <AlertTriangle className="size-4 shrink-0" />
          {openCount === 1 ? '1 caja por cerrar' : `${openCount} cajas por cerrar`}
          <span className="font-normal">· escribe su costo real cuando llegue.</span>
        </p>
      )}
    </div>
  )
}

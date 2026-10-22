import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { useDeleteMovement, useProductStock, type ProductStock } from '@/api/stock'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DeliveryBadge } from '@/components/orders/StatusBadges'
import { StockBadge } from '@/components/stock/StockBadge'
import { StockMovementForm } from '@/components/stock/StockMovementForm'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatUsd } from '@/lib/format'
import { movementKindLabel } from '@/lib/stock'
import { cn } from '@/lib/utils'

export function ProductoInventarioPage() {
  const { productId = '' } = useParams()
  const product = useProductStock(productId)

  if (product.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando producto…</p>
  if (product.isError) {
    return <p className="py-8 text-center text-destructive">No se pudo cargar: {errorMessage(product.error)}</p>
  }
  if (!product.data) return <p className="py-8 text-center text-muted-foreground">Este producto no existe.</p>

  return <ProductView product={product.data} />
}

function ProductView({ product }: { product: ProductStock }) {
  const deleteMovement = useDeleteMovement()
  const [form, setForm] = useState<'ingreso' | 'ajuste' | null>(null)
  const [movementToDelete, setMovementToDelete] = useState<string | null>(null)

  const removeMovement = async (movementId: string) => {
    try {
      await deleteMovement.mutateAsync(movementId)
      toast.success('Movimiento borrado')
    } catch (error) {
      toast.error(`No se pudo borrar: ${errorMessage(error)}`)
    }
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <div>
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <StockBadge state={product.state} />
        </div>
        <dl className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
          <Stat label="Disponible" value={product.availableQty} strong />
          <Stat label="Ingresado" value={product.enteredQty} />
          <Stat label="Vendido" value={product.soldQty} />
        </dl>
        {product.state === 'revisar' && (
          <p className="text-sm text-red-700">
            Se vendió más de lo ingresado. Revisa los movimientos y las ventas de abajo, o haz un ajuste.
          </p>
        )}
      </section>

      {form ? (
        <StockMovementForm
          key={form}
          kind={form}
          product={{ id: product.productId, name: product.name, availableQty: product.availableQty }}
          onDone={() => setForm(null)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-11" onClick={() => setForm('ingreso')}>
            Ingreso
          </Button>
          <Button variant="outline" className="h-11" onClick={() => setForm('ajuste')}>
            Ajuste
          </Button>
        </div>
      )}

      <section className="grid gap-2">
        <h3 className="font-semibold">Movimientos</h3>
        {product.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ingresos ni ajustes.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {product.movements.map((movement) => (
              <li key={movement.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {movementKindLabel[movement.kind]}{' '}
                    <span className={cn('tabular-nums', movement.qty < 0 ? 'text-red-700' : 'text-emerald-700')}>
                      {movement.qty > 0 ? `+${movement.qty}` : movement.qty}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      formatDate(movement.movedOn),
                      movement.unitCostUsd !== null && `${formatUsd(movement.unitCostUsd)} c/u`,
                      movement.shipmentCode && `caja ${movement.shipmentCode}`,
                      movement.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label="Borrar movimiento"
                  onClick={() => setMovementToDelete(movement.id)}
                >
                  <Trash2 className="size-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h3 className="font-semibold">Ventas desde el inventario</h3>
        {product.sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún pedido ha sacado este producto del inventario.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {product.sales.map((sale) => {
              const counts = sale.orderStatus !== 'cotizado' && sale.orderStatus !== 'anulado'
              return (
                <li key={sale.id}>
                  <Link
                    to={`/pedidos/${sale.orderId}`}
                    className={cn('flex items-center gap-3 p-3 hover:bg-muted/50', !counts && 'opacity-60')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {sale.qty} × {sale.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(sale.orderedOn)}
                        {!counts && ' · no descuenta'}
                      </p>
                    </div>
                    <DeliveryBadge status={sale.orderStatus} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={movementToDelete !== null}
        onOpenChange={(open) => !open && setMovementToDelete(null)}
        title="¿Borrar este movimiento?"
        description="El disponible se vuelve a calcular sin él."
        confirmLabel="Borrar"
        destructive
        onConfirm={() => movementToDelete && void removeMovement(movementToDelete)}
      />
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          strong ? 'text-2xl font-semibold' : 'text-lg font-medium',
          strong && value < 0 && 'text-red-700',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

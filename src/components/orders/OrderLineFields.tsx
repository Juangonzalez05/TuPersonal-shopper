import { AlertTriangle, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import type { Product } from '@/api/products'
import { Autocomplete } from '@/components/Autocomplete'
import { NumberField } from '@/components/NumberField'
import { IncompleteBadge } from '@/components/orders/StatusBadges'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { decimalInputValue, formatCop, formatPercent } from '@/lib/format'
import { toLineInput, type OrderFormValues } from '@/lib/order-form'
import { impliedMarkup, lineTotals } from '@/lib/pricing'
import { stockWarning, type Shortage, type StockLevels } from '@/lib/stock'
import { cn } from '@/lib/utils'

type OrderLineFieldsProps = {
  index: number
  products: Product[]
  /** Disponible y en camino por producto (v_stock). */
  stock: Map<string, StockLevels>
  /** Último costo USD de ingreso por producto, para prellenar si sale del inventario. */
  lastCosts: Map<string, number>
  /** Último precio c/u cobrado por producto, para prellenar el precio. */
  unitPrices: Map<string, number>
  /** Productos que no alcanzan, sumando todas las líneas del pedido. */
  shortages: Map<string, Shortage>
  onRemove?: () => void
}

const missingLabel = { trm: 'falta TRM', price: 'falta precio' }

/** "3 disp. · +2 en camino" */
function stockText(levels: StockLevels | undefined): string {
  const { available, inTransit } = levels ?? { available: 0, inTransit: 0 }
  return inTransit > 0 ? `${available} disp. · +${inTransit} en camino` : `${available} disp.`
}

export function OrderLineFields({
  index,
  products,
  stock,
  lastCosts,
  unitPrices,
  shortages,
  onRemove,
}: OrderLineFieldsProps) {
  const switchId = useId()
  const { control, register, setValue, trigger, formState } = useFormContext<OrderFormValues>()
  const line = useWatch({ control, name: `lines.${index}` })
  const errors = formState.errors.lines?.[index]
  const input = toLineInput(line)
  const totals = lineTotals(input)
  const shortage = line.fromStock && line.productId ? shortages.get(line.productId) : undefined
  const warning = shortage ? stockWarning(shortage.available, shortage.requested, shortage.inTransit) : null
  const markup = impliedMarkup(totals.costCop, totals.priceCop)
  // El precio c/u ya trae el envío: si el envío es mayor, el producto queda en negativo.
  const shippingOverPrice = input.unitPriceCop !== null && totals.priceCop < 0

  /** Si sale del inventario y el USD está vacío, usa el último costo de ingreso. */
  const prefillCost = (productId: string) => {
    const cost = lastCosts.get(productId)
    if (cost !== undefined && line.usd.trim() === '') setValue(`lines.${index}.usd`, decimalInputValue(cost))
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={`line-${index}-description`}>Producto {index + 1}</Label>
          <Controller
            control={control}
            name={`lines.${index}.description`}
            render={({ field, fieldState }) => (
              <Autocomplete
                id={`line-${index}-description`}
                ref={field.ref}
                name={field.name}
                placeholder="Buscar o escribir"
                className="h-11 text-base"
                aria-invalid={fieldState.error ? true : undefined}
                value={field.value}
                onBlur={field.onBlur}
                onValueChange={(text) => {
                  field.onChange(text)
                  if (line.productId) setValue(`lines.${index}.productId`, null)
                }}
                options={products}
                getKey={(p) => p.id}
                getLabel={(p) => p.name}
                renderOption={(p) => (
                  <span className="flex items-baseline justify-between gap-2">
                    <span>{p.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {[
                        line.fromStock && stockText(stock.get(p.id)),
                        unitPrices.has(p.id) && formatCop(unitPrices.get(p.id)!),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                )}
                onSelect={(p) => {
                  field.onChange(p.name)
                  setValue(`lines.${index}.productId`, p.id, { shouldValidate: formState.isSubmitted })
                  // El precio de la última vez que se vendió, si aún no escribió uno.
                  const lastPrice = unitPrices.get(p.id)
                  if (lastPrice !== undefined && line.price.trim() === '') {
                    setValue(`lines.${index}.price`, String(lastPrice))
                  }
                  if (line.fromStock) prefillCost(p.id)
                  if (formState.isSubmitted) void trigger(`lines.${index}`)
                }}
              />
            )}
          />
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground"
            aria-label={`Quitar producto ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2 className="size-5" />
          </Button>
        )}
      </div>
      {errors?.description ? (
        <p className="-mt-1 text-xs text-destructive">{errors.description.message}</p>
      ) : (
        line.description.trim() !== '' && (
          <p className="-mt-1 text-xs text-muted-foreground">
            {line.productId
              ? line.fromStock
                ? `Del inventario · ${stockText(stock.get(line.productId))}`
                : 'Del catálogo'
              : line.fromStock
                ? 'Elige un producto de la lista para sacarlo del inventario'
                : 'Texto libre (no se liga a un producto del inventario)'}
          </p>
        )
      )}

      <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
        <Label htmlFor={switchId}>Sale del inventario</Label>
        <Switch
          id={switchId}
          checked={line.fromStock}
          onCheckedChange={(checked) => {
            setValue(`lines.${index}.fromStock`, checked)
            if (checked && line.productId) prefillCost(line.productId)
            if (formState.isSubmitted) void trigger(`lines.${index}`)
          }}
        />
      </div>
      {warning && (
        <p className="-mt-1 flex items-center gap-1.5 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          {warning}
          {/* Otras líneas piden el mismo producto: el aviso es por el total. */}
          {shortage && shortage.requested !== input.qty && ` (${shortage.requested} en todo el pedido)`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="USD c/u" placeholder="0,00" error={errors?.usd?.message} {...register(`lines.${index}.usd`)} />
        <NumberField
          label="Cantidad"
          inputMode="numeric"
          error={errors?.qty?.message}
          {...register(`lines.${index}.qty`)}
        />
        <NumberField label="TRM" placeholder="0" error={errors?.trm?.message} {...register(`lines.${index}.trm`)} />
        <NumberField
          label="Precio c/u al cliente"
          prefix="$"
          placeholder="0"
          error={errors?.price?.message}
          {...register(`lines.${index}.price`)}
        />
      </div>
      <NumberField
        label="Envío / gestión (incluido en el precio)"
        prefix="$"
        placeholder="0"
        error={errors?.shipping?.message}
        {...register(`lines.${index}.shipping`)}
      />

      <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2 text-center">
        <LiveValue label="Costo" value={totals.costCop} />
        <LiveValue label="Cobras" value={totals.totalCop} />
        <LiveValue label="Ganancia" value={totals.profitCop} highlight />
      </dl>
      {(totals.shippingChargedCop > 0 || (markup !== null && totals.priceCop > 0)) && (
        <p className="-mt-1 text-center text-xs text-muted-foreground">
          {totals.shippingChargedCop > 0 && <>Incluye envío {formatCop(totals.shippingChargedCop)}</>}
          {totals.shippingChargedCop > 0 && markup !== null && totals.priceCop > 0 && ' · '}
          {markup !== null && totals.priceCop > 0 && (
            <>
              Incremento del producto:{' '}
              <span className="font-medium text-foreground">{formatPercent(markup)}</span>
            </>
          )}
        </p>
      )}
      {shippingOverPrice && (
        <p className="-mt-1 flex items-center gap-1.5 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          El envío es mayor que lo que cobras por este producto.
        </p>
      )}
      {totals.incomplete && (
        <IncompleteBadge>{`Incompleta · ${totals.missing.map((m) => missingLabel[m]).join(' y ')}`}</IncompleteBadge>
      )}
    </div>
  )
}

function LiveValue({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-sm font-medium tabular-nums',
          highlight && (value < 0 ? 'text-red-700' : 'text-emerald-700'),
        )}
      >
        {formatCop(value)}
      </dd>
    </div>
  )
}

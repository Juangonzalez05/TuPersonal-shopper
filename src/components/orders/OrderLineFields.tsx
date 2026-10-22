import { Trash2 } from 'lucide-react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import type { Product } from '@/api/products'
import { Autocomplete } from '@/components/Autocomplete'
import { NumberField } from '@/components/NumberField'
import { IncompleteBadge } from '@/components/orders/StatusBadges'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatCop, formatPercent, percentInputValue } from '@/lib/format'
import { toLineInput, type OrderFormValues } from '@/lib/order-form'
import { lineTotals } from '@/lib/pricing'
import { cn } from '@/lib/utils'

type OrderLineFieldsProps = {
  index: number
  products: Product[]
  onRemove?: () => void
}

const missingLabel = { trm: 'falta TRM', pct: 'falta %' }

export function OrderLineFields({ index, products, onRemove }: OrderLineFieldsProps) {
  const { control, register, setValue, formState } = useFormContext<OrderFormValues>()
  const line = useWatch({ control, name: `lines.${index}` })
  const errors = formState.errors.lines?.[index]
  const totals = lineTotals(toLineInput(line))

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
                    {p.defaultMarkup !== null && (
                      <span className="text-sm text-muted-foreground">{formatPercent(p.defaultMarkup)}</span>
                    )}
                  </span>
                )}
                onSelect={(p) => {
                  field.onChange(p.name)
                  setValue(`lines.${index}.productId`, p.id)
                  if (p.defaultMarkup !== null) {
                    setValue(`lines.${index}.pct`, percentInputValue(p.defaultMarkup))
                  }
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
            {line.productId ? 'Del catálogo' : 'Texto libre (no se liga a un producto del inventario)'}
          </p>
        )
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
          label="% incremento"
          suffix="%"
          error={errors?.pct?.message}
          {...register(`lines.${index}.pct`)}
        />
      </div>
      <NumberField
        label="Envío / gestión cobrado"
        prefix="$"
        placeholder="0"
        error={errors?.shipping?.message}
        {...register(`lines.${index}.shipping`)}
      />

      <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2 text-center">
        <LiveValue label="Costo" value={totals.costCop} />
        <LiveValue label="Precio" value={totals.priceCop} />
        <LiveValue label="Ganancia" value={totals.profitCop} highlight />
      </dl>
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
      <dd className={cn('text-sm font-medium tabular-nums', highlight && 'text-emerald-700')}>{formatCop(value)}</dd>
    </div>
  )
}

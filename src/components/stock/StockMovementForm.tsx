import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useCreateProduct, useProducts, type Product } from '@/api/products'
import { useShipments } from '@/api/shipments'
import { useCreateMovement } from '@/api/stock'
import { Autocomplete } from '@/components/Autocomplete'
import { NumberField } from '@/components/NumberField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage, isUniqueViolation } from '@/lib/errors'
import { parseDecimal, todayBogota } from '@/lib/format'
import { productKey } from '@/lib/product-name'
import { adjustmentQty, type AdjustmentDirection } from '@/lib/stock'
import { cn } from '@/lib/utils'

const movementSchema = z.object({
  qty: z.string().refine((value) => {
    const n = parseDecimal(value)
    return n !== null && Number.isInteger(n) && n >= 1 && n <= 100_000
  }, 'Cantidad entera desde 1.'),
  usd: z.string().refine((value) => {
    if (value.trim() === '') return true
    const n = parseDecimal(value)
    return n !== null && n <= 99_999_999.99
  }, 'Valor en USD inválido.'),
  shipmentId: z.string(),
  movedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  note: z.string(),
})

type MovementValues = z.infer<typeof movementSchema>

type StockMovementFormProps = {
  kind: 'ingreso' | 'ajuste'
  /** Producto fijo (detalle del producto); si no viene, se elige o se crea en el formulario. */
  product?: { id: string; name: string; availableQty: number }
  onDone: () => void
}

/** Registrar un ingreso de stock o un ajuste (sumar/restar con motivo). */
export function StockMovementForm({ kind, product, onDone }: StockMovementFormProps) {
  const id = useId()
  const products = useProducts()
  const shipments = useShipments()
  const createProduct = useCreateProduct()
  const createMovement = useCreateMovement()
  const [picked, setPicked] = useState<Pick<Product, 'id' | 'name'> | null>(product ?? null)
  const [productText, setProductText] = useState(product?.name ?? '')
  const [productError, setProductError] = useState<string | null>(null)
  const [direction, setDirection] = useState<AdjustmentDirection>('restar')

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MovementValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { qty: '', usd: '', shipmentId: '', movedOn: todayBogota(), note: '' },
  })

  const catalog = products.data ?? []
  const typed = productText.trim()
  const existing = typed ? catalog.find((p) => productKey(p.name) === productKey(typed)) : undefined
  const qty = parseDecimal(useWatch({ control, name: 'qty' })) ?? 0
  const afterAdjustment = product ? product.availableQty + adjustmentQty(direction, qty) : null
  const pending = createProduct.isPending || createMovement.isPending

  const resolveProduct = async (): Promise<Pick<Product, 'id' | 'name'> | null> => {
    if (picked) return picked
    if (existing) return existing
    if (!typed) {
      setProductError('Elige un producto o escribe uno nuevo.')
      return null
    }
    try {
      const created = await createProduct.mutateAsync(typed)
      toast.success(`Producto creado: ${created.name}`)
      return created
    } catch (error) {
      setProductError(
        isUniqueViolation(error) ? 'Ya existe un producto con ese nombre.' : `No se pudo crear: ${errorMessage(error)}`,
      )
      return null
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const target = await resolveProduct()
    if (!target) return
    const units = parseDecimal(values.qty)!
    const signedQty = kind === 'ajuste' ? adjustmentQty(direction, units) : units
    try {
      await createMovement.mutateAsync({
        productId: target.id,
        kind,
        qty: signedQty,
        unitCostUsd: kind === 'ingreso' ? parseDecimal(values.usd) : null,
        shipmentId: kind === 'ingreso' && values.shipmentId ? values.shipmentId : null,
        movedOn: values.movedOn,
        note: values.note.trim() || null,
      })
      toast.success(
        kind === 'ingreso'
          ? `Ingreso registrado: +${units} ${target.name}`
          : `Ajuste registrado: ${signedQty > 0 ? '+' : ''}${signedQty} ${target.name}`,
      )
      onDone()
    } catch (error) {
      toast.error(`No se pudo registrar: ${errorMessage(error)}`)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3">
      <h3 className="font-medium">{kind === 'ingreso' ? 'Registrar ingreso' : 'Ajuste de inventario'}</h3>

      {!product && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-product`}>Producto</Label>
          <Autocomplete
            id={`${id}-product`}
            placeholder="Buscar o escribir uno nuevo"
            className="h-11 text-base"
            value={productText}
            aria-invalid={productError ? true : undefined}
            options={catalog}
            getKey={(p) => p.id}
            getLabel={(p) => p.name}
            onValueChange={(text) => {
              setProductText(text)
              setPicked(null)
              setProductError(null)
            }}
            onSelect={(p) => {
              setProductText(p.name)
              setPicked(p)
              setProductError(null)
            }}
            extraOption={
              typed && !existing && !picked
                ? {
                    label: (
                      <span className="flex items-center gap-2 font-medium">
                        <PackagePlus className="size-4" />
                        Crear producto «{typed}»
                      </span>
                    ),
                    onSelect: () => setProductError(null),
                  }
                : null
            }
          />
          {productError ? (
            <p className="text-xs text-destructive">{productError}</p>
          ) : (
            typed &&
            !picked &&
            !existing && <p className="text-xs text-muted-foreground">Se creará como producto nuevo al guardar.</p>
          )}
        </div>
      )}

      {kind === 'ajuste' && (
        <div role="group" aria-label="Tipo de ajuste" className="grid h-11 grid-cols-2 rounded-md border p-1">
          {(['sumar', 'restar'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={direction === value}
              onClick={() => setDirection(value)}
              className={cn(
                'rounded-sm text-sm font-medium transition-colors',
                direction === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {value === 'sumar' ? 'Sumar' : 'Restar'}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Cantidad" inputMode="numeric" error={errors.qty?.message} {...register('qty')} />
        {kind === 'ingreso' ? (
          <NumberField label="Costo USD c/u" placeholder="Opcional" error={errors.usd?.message} {...register('usd')} />
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Fecha</Label>
            <Input id={`${id}-date`} type="date" className="h-11 text-base" {...register('movedOn')} />
          </div>
        )}
      </div>

      {kind === 'ingreso' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-shipment`}>Caja</Label>
            <NativeSelect
              id={`${id}-shipment`}
              containerClassName="w-full"
              className="h-11 text-base"
              {...register('shipmentId')}
            >
              <NativeSelectOption value="">Sin caja</NativeSelectOption>
              {(shipments.data ?? []).map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Fecha</Label>
            <Input id={`${id}-date`} type="date" className="h-11 text-base" {...register('movedOn')} />
          </div>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-note`}>{kind === 'ajuste' ? 'Motivo' : 'Nota'}</Label>
        <Input
          id={`${id}-note`}
          placeholder={kind === 'ajuste' ? 'Ej.: conteo, dañado, regalo' : 'Opcional'}
          className="h-11 text-base"
          {...register('note')}
        />
      </div>

      {afterAdjustment !== null && kind === 'ajuste' && qty > 0 && (
        <p className={cn('text-sm', afterAdjustment < 0 ? 'text-red-700' : 'text-muted-foreground')}>
          Quedarían {afterAdjustment} disponibles{afterAdjustment < 0 && ': el producto quedará por revisar'}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-11" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

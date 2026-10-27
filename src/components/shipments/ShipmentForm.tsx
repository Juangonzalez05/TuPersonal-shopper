import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus, Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { useProducts } from '@/api/products'
import { Autocomplete } from '@/components/Autocomplete'
import { NumberField } from '@/components/NumberField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseDecimal } from '@/lib/format'
import { productKey } from '@/lib/product-name'
import type { ShipmentFormText } from '@/lib/shipments'

const isBlank = (value: string) => value.trim() === ''

const stockRowSchema = z
  .object({
    productId: z.string().nullable(),
    productName: z.string(),
    qty: z.string(),
    usd: z.string().refine((value) => isBlank(value) || parseDecimal(value) !== null, 'Valor en USD inválido.'),
  })
  // Una fila vacía se ignora; si tiene producto, necesita cantidad entera desde 1.
  .refine(
    (row) => {
      if (isBlank(row.productName)) return true
      const n = parseDecimal(row.qty)
      return n !== null && Number.isInteger(n) && n >= 1
    },
    { path: ['qty'], message: 'Cantidad entera desde 1.' },
  )

const shipmentSchema = z.object({
  code: z.string().trim().min(1, 'Escribe el código de la caja.'),
  carrier: z.string(),
  shippedOn: z.string(),
  expectedOn: z.string(),
  realCost: z.string().refine((value) => isBlank(value) || parseDecimal(value) !== null, 'Valor inválido.'),
  notes: z.string(),
  stock: z.array(stockRowSchema),
})

export type ShipmentFormValues = z.infer<typeof shipmentSchema>

const emptyStockRow = () => ({ productId: null, productName: '', qty: '1', usd: '' })

type ShipmentFormProps = {
  defaultValues: ShipmentFormText
  /** Couriers ya usados, como sugerencias. */
  carriers: string[]
  /** Al crear se pueden anotar los productos de inventario que trae; al editar no. */
  withStock: boolean
  submitLabel: string
  pending: boolean
  onSubmit: (values: ShipmentFormValues) => void
  onCancel: () => void
}

/** Crear o editar una caja: código, courier, despacho, llegada estimada, costo del envío y notas. */
export function ShipmentForm({
  defaultValues,
  carriers,
  withStock,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: ShipmentFormProps) {
  const id = useId()
  const products = useProducts()
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: { ...defaultValues, stock: withStock ? [emptyStockRow()] : [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'stock' })
  const stock = useWatch({ control, name: 'stock' })
  const catalog = products.data ?? []

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-code`}>Código</Label>
          <Input
            id={`${id}-code`}
            autoCapitalize="characters"
            className="h-11 text-base"
            aria-invalid={errors.code ? true : undefined}
            {...register('code')}
          />
        </div>
        <NumberField
          label="Costo del envío"
          prefix="$"
          placeholder="Si ya lo sabes"
          error={errors.realCost?.message}
          {...register('realCost')}
        />
      </div>
      {errors.code && <p className="-mt-1 text-xs text-destructive">{errors.code.message}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-shipped`}>Despacho</Label>
          <Input id={`${id}-shipped`} type="date" className="h-11 text-base" {...register('shippedOn')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-expected`}>Llegada estimada</Label>
          <Input id={`${id}-expected`} type="date" className="h-11 text-base" {...register('expectedOn')} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-carrier`}>Courier / casillero</Label>
        <Input
          id={`${id}-carrier`}
          list={`${id}-carriers`}
          placeholder="Opcional"
          className="h-11 text-base"
          {...register('carrier')}
        />
        <datalist id={`${id}-carriers`}>
          {carriers.map((carrier) => (
            <option key={carrier} value={carrier} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-notes`}>Notas</Label>
        <Input id={`${id}-notes`} placeholder="Opcional" className="h-11 text-base" {...register('notes')} />
      </div>

      {withStock && (
        <section className="grid gap-2 rounded-md bg-muted/40 p-2">
          <div>
            <h3 className="text-sm font-semibold">Productos para el inventario</h3>
            <p className="text-xs text-muted-foreground">
              Entran al inventario como "en camino" y pasan a disponibles cuando marques que la caja llegó. Los
              productos de pedidos de clientes se agregan después, desde la caja.
            </p>
          </div>
          {fields.map((field, index) => {
            const row = stock[index]
            const typed = row?.productName.trim() ?? ''
            const exists = typed !== '' && catalog.some((p) => productKey(p.name) === productKey(typed))
            return (
              <div key={field.id} className="grid gap-2 rounded-md border bg-background p-2">
                <div className="flex items-end gap-2">
                  <div className="grid flex-1 gap-1.5">
                    <Label htmlFor={`${id}-stock-${index}`}>Producto</Label>
                    <Controller
                      control={control}
                      name={`stock.${index}.productName`}
                      render={({ field: input }) => (
                        <Autocomplete
                          id={`${id}-stock-${index}`}
                          placeholder="Buscar o escribir uno nuevo"
                          className="h-11 text-base"
                          value={input.value}
                          onValueChange={(text) => {
                            input.onChange(text)
                            setValue(`stock.${index}.productId`, null)
                          }}
                          options={catalog}
                          getKey={(p) => p.id}
                          getLabel={(p) => p.name}
                          onSelect={(p) => {
                            input.onChange(p.name)
                            setValue(`stock.${index}.productId`, p.id)
                          }}
                          extraOption={
                            typed && !exists && !row?.productId
                              ? {
                                  label: (
                                    <span className="flex items-center gap-2 font-medium">
                                      <PackagePlus className="size-4" />
                                      Producto nuevo «{typed}»
                                    </span>
                                  ),
                                  onSelect: () => undefined,
                                }
                              : null
                          }
                        />
                      )}
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 text-muted-foreground"
                      aria-label="Quitar producto"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-5" />
                    </Button>
                  )}
                </div>
                {typed && !row?.productId && !exists && (
                  <p className="-mt-1 text-xs text-muted-foreground">Se creará como producto nuevo.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Cantidad"
                    inputMode="numeric"
                    error={errors.stock?.[index]?.qty?.message}
                    {...register(`stock.${index}.qty`)}
                  />
                  <NumberField
                    label="Costo USD c/u"
                    placeholder="Opcional"
                    error={errors.stock?.[index]?.usd?.message}
                    {...register(`stock.${index}.usd`)}
                  />
                </div>
              </div>
            )
          })}
          <Button type="button" variant="outline" className="h-11" onClick={() => append(emptyStockRow())}>
            <Plus />
            Otro producto
          </Button>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

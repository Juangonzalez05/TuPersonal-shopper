import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useCustomers } from '@/api/customers'
import { useLastPricing } from '@/api/orders'
import { useProducts } from '@/api/products'
import { useLastStockCosts, useStock } from '@/api/stock'
import { NumberField } from '@/components/NumberField'
import { CustomerPicker } from '@/components/orders/CustomerPicker'
import { OrderLineFields } from '@/components/orders/OrderLineFields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { decimalInputValue, formatCop } from '@/lib/format'
import { PAYMENT_METHODS } from '@/lib/order-labels'
import {
  emptyLine,
  initialPaymentCop,
  orderFormSchema,
  toLineInput,
  type OrderFormValues,
  type PaymentMode,
} from '@/lib/order-form'
import { orderTotals } from '@/lib/pricing'
import { stockShortages, type StockLevels } from '@/lib/stock'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'cotizado', label: 'Cotización' },
  { value: 'confirmado', label: 'Confirmado' },
] as const

const PAYMENT_OPTIONS: { value: PaymentMode; label: string }[] = [
  { value: 'none', label: 'Sin pago' },
  { value: 'abono', label: 'Abono' },
  { value: 'total', label: 'Pagado' },
]

type OrderFormProps = {
  /** "create": tipo y pago inicial. "edit": solo datos y productos (pago y estado van en el detalle). */
  mode: 'create' | 'edit'
  defaultValues: OrderFormValues
  pending: boolean
  submitLabel: string
  onSubmit: (values: OrderFormValues) => void
}

/** Formulario de pedido para crear y editar: cliente, productos con cálculo en vivo y pago. */
export function OrderForm({ mode, defaultValues, pending, submitLabel, onSubmit }: OrderFormProps) {
  const customers = useCustomers()
  const products = useProducts()
  const stock = useStock()
  const lastCosts = useLastStockCosts()
  const lastPricing = useLastPricing()

  const form = useForm<OrderFormValues>({ resolver: zodResolver(orderFormSchema), defaultValues })
  const { control, register, setValue, getValues, getFieldState, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  // La última TRM llega después de montar: se pone solo donde no se ha escrito (pedidos nuevos).
  useEffect(() => {
    const trm = lastPricing.data?.trm
    if (mode !== 'create' || trm == null) return
    getValues('lines').forEach((line, index) => {
      if (line.trm === '' && !getFieldState(`lines.${index}.trm`).isDirty) {
        setValue(`lines.${index}.trm`, decimalInputValue(trm))
      }
    })
  }, [mode, lastPricing.data, getValues, getFieldState, setValue])

  const values = useWatch({ control }) as OrderFormValues
  const lines = values.lines ?? []
  const paid = mode === 'create' ? initialPaymentCop(values) : 0
  const totals = orderTotals(lines.map(toLineInput), paid)
  const stockLevels = new Map<string, StockLevels>(
    (stock.data ?? []).map((item) => [item.productId, { available: item.availableQty, inTransit: item.inTransitQty }]),
  )
  const shortages = stockShortages(
    lines.map((line) => ({ productId: line.productId, fromStock: line.fromStock, qty: toLineInput(line).qty })),
    stockLevels,
  )

  const addLine = () => {
    const previous = getValues('lines').at(-1)
    append(emptyLine({ trm: (previous && toLineInput(previous).trm) || lastPricing.data?.trm }))
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        // Enter en un campo no guarda: solo el botón "Guardar".
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
        }}
        className="grid gap-5 pb-24"
      >
        <CustomerPicker customers={customers.data ?? []} />

        <div className={cn('grid gap-3', mode === 'create' && 'grid-cols-2')}>
          {mode === 'create' && (
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Segmented
                label="Tipo de pedido"
                options={STATUS_OPTIONS}
                value={values.status}
                onChange={(value) => setValue('status', value)}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="ordered-on">Fecha</Label>
            <Input id="ordered-on" type="date" className="h-11 text-base" {...register('orderedOn')} />
          </div>
        </div>

        <section className="grid gap-3">
          <h2 className="font-semibold">Productos</h2>
          {fields.map((field, index) => (
            <OrderLineFields
              key={field.id}
              index={index}
              products={products.data ?? []}
              stock={stockLevels}
              lastCosts={lastCosts.data ?? new Map()}
              unitPrices={lastPricing.data?.unitPrices ?? new Map()}
              shortages={shortages}
              onRemove={fields.length > 1 ? () => remove(index) : undefined}
            />
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={addLine}>
            <Plus />
            Agregar producto
          </Button>
        </section>

        {mode === 'create' && (
          <section className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Pago</Label>
              <Segmented
                label="Pago"
                options={PAYMENT_OPTIONS}
                value={values.paymentMode}
                onChange={(value) => setValue('paymentMode', value, { shouldValidate: formState.isSubmitted })}
              />
            </div>
            {values.paymentMode !== 'none' && (
              <div className="grid grid-cols-2 items-end gap-3">
                {values.paymentMode === 'abono' ? (
                  <NumberField
                    label="Valor del abono"
                    prefix="$"
                    placeholder="0"
                    error={formState.errors.initialPayment?.message}
                    {...register('initialPayment')}
                  />
                ) : (
                  <div className="grid gap-1.5">
                    <Label>Valor pagado</Label>
                    <p className="flex h-11 items-center rounded-md bg-muted/60 px-3 text-base font-medium tabular-nums">
                      {formatCop(totals.totalCop)}
                    </p>
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="payment-method">Medio de pago</Label>
                  <NativeSelect
                    id="payment-method"
                    containerClassName="w-full"
                    className="h-11 text-base"
                    {...register('paymentMethod')}
                  >
                    <NativeSelectOption value="">Sin especificar</NativeSelectOption>
                    {PAYMENT_METHODS.map((method) => (
                      <NativeSelectOption key={method} value={method}>
                        {method}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="order-notes">Notas</Label>
          <Input id="order-notes" placeholder="Opcional" className="h-11 text-base" {...register('notes')} />
        </div>

        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1 text-sm leading-tight">
              <p>
                Total <strong className="tabular-nums">{formatCop(totals.totalCop)}</strong>
              </p>
              <p className="text-muted-foreground">
                Ganancia <span className="tabular-nums">{formatCop(totals.itemsProfitCop)}</span>
                {totals.paidCop > 0 && (
                  <>
                    {' · '}Saldo <span className="tabular-nums">{formatCop(totals.balanceCop)}</span>
                  </>
                )}
              </p>
              {totals.incompleteItems > 0 && (
                <p className="text-amber-700">
                  {totals.incompleteItems === 1 ? '1 línea incompleta' : `${totals.incompleteItems} líneas incompletas`}
                </p>
              )}
            </div>
            <Button type="submit" size="lg" className="h-12 px-6 text-base" disabled={pending}>
              {pending ? 'Guardando…' : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid h-11 rounded-md border p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-sm text-sm font-medium transition-colors',
            value === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

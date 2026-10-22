import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCustomers } from '@/api/customers'
import { useCreateOrder, useLastPricing } from '@/api/orders'
import { useProducts } from '@/api/products'
import { NumberField } from '@/components/NumberField'
import { CustomerPicker } from '@/components/orders/CustomerPicker'
import { OrderLineFields } from '@/components/orders/OrderLineFields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/errors'
import { decimalInputValue, formatCop, parseCop, parsePercent, percentInputValue, todayBogota } from '@/lib/format'
import { PAYMENT_METHODS } from '@/lib/order-labels'
import {
  emptyLine,
  emptyOrder,
  orderFormSchema,
  toCreateOrderArgs,
  toLineInput,
  type OrderFormValues,
} from '@/lib/order-form'
import { orderTotals } from '@/lib/pricing'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'cotizado', label: 'Cotización' },
  { value: 'confirmado', label: 'Confirmado' },
] as const

export function NuevoPedidoPage() {
  const navigate = useNavigate()
  const customers = useCustomers()
  const products = useProducts()
  const lastPricing = useLastPricing()
  const createOrder = useCreateOrder()

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: emptyOrder(todayBogota()),
  })
  const { control, register, setValue, getValues, getFieldState, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  // La última TRM y el último % llegan después de montar: se ponen solo donde no se ha escrito.
  useEffect(() => {
    const last = lastPricing.data
    if (!last) return
    getValues('lines').forEach((line, index) => {
      if (last.trm !== null && line.trm === '' && !getFieldState(`lines.${index}.trm`).isDirty) {
        setValue(`lines.${index}.trm`, decimalInputValue(last.trm))
      }
      if (last.markupPct !== null && line.pct === '' && !getFieldState(`lines.${index}.pct`).isDirty) {
        setValue(`lines.${index}.pct`, percentInputValue(last.markupPct))
      }
    })
  }, [lastPricing.data, getValues, getFieldState, setValue])

  const [lines, status, initialPayment] = useWatch({ control, name: ['lines', 'status', 'initialPayment'] })
  const totals = orderTotals(lines.map(toLineInput), parseCop(initialPayment) ?? 0)

  const addLine = () => {
    const previous = getValues('lines').at(-1)
    append(
      emptyLine({
        trm: (previous && toLineInput(previous).trm) || lastPricing.data?.trm,
        markupPct: (previous && parsePercent(previous.pct)) ?? lastPricing.data?.markupPct,
      }),
    )
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const orderId = await createOrder.mutateAsync(toCreateOrderArgs(values))
      toast.success('Pedido guardado')
      navigate(`/pedidos/${orderId}`, { replace: true })
    } catch (error) {
      toast.error(`No se pudo guardar: ${errorMessage(error)}`)
    }
  })

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={onSubmit}
        // Enter en un campo no guarda: solo el botón "Guardar".
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
        }}
        className="grid gap-5 pb-24"
      >
        <CustomerPicker customers={customers.data ?? []} />

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <div role="group" aria-label="Tipo de pedido" className="grid h-11 grid-cols-2 rounded-md border p-1">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={status === option.value}
                  onClick={() => setValue('status', option.value)}
                  className={cn(
                    'rounded-sm text-sm font-medium transition-colors',
                    status === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
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
              onRemove={fields.length > 1 ? () => remove(index) : undefined}
            />
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={addLine}>
            <Plus />
            Agregar producto
          </Button>
        </section>

        <section className="grid grid-cols-2 items-end gap-3">
          <NumberField
            label="Abono inicial (opcional)"
            prefix="$"
            placeholder="0"
            error={formState.errors.initialPayment?.message}
            {...register('initialPayment')}
          />
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
        </section>

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
            <Button type="submit" size="lg" className="h-12 px-6 text-base" disabled={createOrder.isPending}>
              {createOrder.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

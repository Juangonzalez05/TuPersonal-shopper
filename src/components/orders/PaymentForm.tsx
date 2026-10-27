import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { Payment } from '@/api/orders'
import { useAddPayment, useUpdatePayment } from '@/api/payments'
import { NumberField } from '@/components/NumberField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/errors'
import { parseCop, todayBogota } from '@/lib/format'
import { PAYMENT_METHODS } from '@/lib/order-labels'

const paymentSchema = z.object({
  amount: z.string().refine((value) => (parseCop(value) ?? 0) > 0, 'Escribe el valor del abono.'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  method: z.string(),
  note: z.string(),
})

type PaymentValues = z.infer<typeof paymentSchema>

type PaymentFormProps = {
  orderId: string
  balanceCop: number
  /** Si viene, el formulario edita ese abono en vez de registrar uno nuevo. */
  payment?: Payment
  onDone?: () => void
}

/** Registrar un abono (el monto arranca con el saldo pendiente) o corregir uno ya registrado. */
export function PaymentForm({ orderId, balanceCop, payment, onDone }: PaymentFormProps) {
  const addPayment = useAddPayment(orderId)
  const updatePayment = useUpdatePayment()
  const pending = addPayment.isPending || updatePayment.isPending
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: payment
      ? {
          amount: String(payment.amountCop),
          paidOn: payment.paidOn,
          method: payment.method ?? '',
          note: payment.note ?? '',
        }
      : {
          amount: balanceCop > 0 ? String(balanceCop) : '',
          paidOn: todayBogota(),
          method: '',
          note: '',
        },
  })

  const onSubmit = handleSubmit(async (values) => {
    const fields = {
      amountCop: parseCop(values.amount)!,
      paidOn: values.paidOn,
      method: values.method || null,
      note: values.note.trim() || null,
    }
    try {
      if (payment) await updatePayment.mutateAsync({ id: payment.id, ...fields })
      else await addPayment.mutateAsync(fields)
      toast.success(payment ? 'Abono actualizado' : 'Abono registrado')
      onDone?.()
    } catch (error) {
      toast.error(`No se pudo guardar el abono: ${errorMessage(error)}`)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3">
      <h3 className="font-medium">{payment ? 'Editar abono' : 'Registrar abono'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Valor" prefix="$" error={errors.amount?.message} {...register('amount')} />
        <div className="grid gap-1.5">
          <Label htmlFor="payment-date">Fecha</Label>
          <Input id="payment-date" type="date" className="h-11 text-base" {...register('paidOn')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-method-detail">Medio</Label>
          <NativeSelect
            id="payment-method-detail"
            containerClassName="w-full"
            className="h-11 text-base"
            {...register('method')}
          >
            <NativeSelectOption value="">Sin especificar</NativeSelectOption>
            {PAYMENT_METHODS.map((method) => (
              <NativeSelectOption key={method} value={method}>
                {method}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-note">Nota</Label>
          <Input id="payment-note" className="h-11 text-base" placeholder="Opcional" {...register('note')} />
        </div>
      </div>
      <div className={payment ? 'grid grid-cols-2 gap-3' : 'grid'}>
        {payment && (
          <Button type="button" variant="outline" className="h-11" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Guardando…' : payment ? 'Guardar' : 'Registrar abono'}
        </Button>
      </div>
    </form>
  )
}

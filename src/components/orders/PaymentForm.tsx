import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAddPayment } from '@/api/payments'
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

/** Registrar un abono. El monto arranca con el saldo pendiente. */
export function PaymentForm({ orderId, balanceCop }: { orderId: string; balanceCop: number }) {
  const addPayment = useAddPayment(orderId)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: balanceCop > 0 ? String(balanceCop) : '',
      paidOn: todayBogota(),
      method: '',
      note: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addPayment.mutateAsync({
        amountCop: parseCop(values.amount)!,
        paidOn: values.paidOn,
        method: values.method || null,
        note: values.note.trim() || null,
      })
      toast.success('Abono registrado')
    } catch (error) {
      toast.error(`No se pudo registrar el abono: ${errorMessage(error)}`)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3">
      <h3 className="font-medium">Registrar abono</h3>
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
      <Button type="submit" className="h-11" disabled={addPayment.isPending}>
        {addPayment.isPending ? 'Guardando…' : 'Registrar abono'}
      </Button>
    </form>
  )
}

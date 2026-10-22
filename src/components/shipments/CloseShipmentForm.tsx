import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useUpdateShipment } from '@/api/shipments'
import { NumberField } from '@/components/NumberField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/errors'
import { formatCop, parseCop, todayBogota } from '@/lib/format'

const closeSchema = z.object({
  realCost: z.string().refine((value) => parseCop(value) !== null, 'Escribe lo que costó la caja.'),
  arrivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escribe la fecha de llegada.'),
})

type CloseValues = z.infer<typeof closeSchema>

/** Cerrar la caja con su costo real; la diferencia se ve antes de guardar. */
export function CloseShipmentForm({
  shipmentId,
  arrivedOn,
  chargedCop,
}: {
  shipmentId: string
  arrivedOn: string | null
  chargedCop: number
}) {
  const updateShipment = useUpdateShipment(shipmentId)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CloseValues>({
    resolver: zodResolver(closeSchema),
    defaultValues: { realCost: '', arrivedOn: arrivedOn ?? todayBogota() },
  })
  const realCost = parseCop(useWatch({ control, name: 'realCost' }))
  const difference = realCost === null ? null : chargedCop - realCost

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateShipment.mutateAsync({ realCostCop: parseCop(values.realCost), arrivedOn: values.arrivedOn })
      toast.success('Caja cerrada')
    } catch (error) {
      toast.error(`No se pudo cerrar la caja: ${errorMessage(error)}`)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3">
      <h3 className="font-medium">Cerrar caja</h3>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Costo real" prefix="$" error={errors.realCost?.message} {...register('realCost')} />
        <div className="grid gap-1.5">
          <Label htmlFor="close-arrived">Llegada</Label>
          <Input id="close-arrived" type="date" className="h-11 text-base" {...register('arrivedOn')} />
        </div>
      </div>
      {difference !== null && (
        <p className={difference < 0 ? 'text-sm text-red-700' : 'text-sm text-emerald-700'}>
          {difference < 0 ? 'Pérdida' : 'Ganancia'} de envío: {formatCop(Math.abs(difference))}
        </p>
      )}
      <Button type="submit" className="h-11" disabled={updateShipment.isPending}>
        {updateShipment.isPending ? 'Guardando…' : 'Cerrar caja'}
      </Button>
    </form>
  )
}

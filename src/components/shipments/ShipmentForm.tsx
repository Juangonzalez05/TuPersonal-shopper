import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const shipmentSchema = z.object({
  code: z.string().trim().min(1, 'Escribe el código de la caja.'),
  carrier: z.string(),
  arrivedOn: z.string(),
  notes: z.string(),
})

export type ShipmentFormValues = z.infer<typeof shipmentSchema>

type ShipmentFormProps = {
  defaultValues: ShipmentFormValues
  /** Couriers ya usados, como sugerencias. */
  carriers: string[]
  submitLabel: string
  pending: boolean
  onSubmit: (values: ShipmentFormValues) => void
  onCancel: () => void
}

/** Crear o editar los datos de una caja: código, courier, fecha de llegada y notas. */
export function ShipmentForm({
  defaultValues,
  carriers,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: ShipmentFormProps) {
  const id = useId()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShipmentFormValues>({ resolver: zodResolver(shipmentSchema), defaultValues })

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
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-arrived`}>Llegada</Label>
          <Input id={`${id}-arrived`} type="date" className="h-11 text-base" {...register('arrivedOn')} />
        </div>
      </div>
      {errors.code && <p className="-mt-1 text-xs text-destructive">{errors.code.message}</p>}
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

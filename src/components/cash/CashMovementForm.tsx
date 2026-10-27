import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  useAddCashMovement,
  useDeleteCashMovement,
  useUpdateCashMovement,
  type CashMovement,
} from '@/api/cash'
import { useOrders } from '@/api/orders'
import { Autocomplete } from '@/components/Autocomplete'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { NumberField } from '@/components/NumberField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { CASH_KINDS, CASH_METHODS, cashKindAction, type CashKind } from '@/lib/cash-flow'
import { errorMessage } from '@/lib/errors'
import { formatCop, formatDate, parseCop, todayBogota } from '@/lib/format'

const cashSchema = z.object({
  kind: z.enum(CASH_KINDS),
  amount: z.string().refine((value) => (parseCop(value) ?? 0) > 0, 'Escribe el valor.'),
  movedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  orderId: z.string().nullable(),
  method: z.string(),
  note: z.string(),
})

type CashValues = z.infer<typeof cashSchema>

/** Pedido ya elegido (desde su detalle): no se cambia y sugiere su costo. */
export type FixedOrder = { id: string; customerName: string; orderedOn: string; costCop: number }

type CashMovementFormProps = {
  /** Tipo con el que arranca: el botón que tocó. */
  kind: CashKind
  /** Si viene, el formulario corrige ese movimiento (y deja borrarlo). */
  movement?: CashMovement
  order?: FixedOrder
  /** Nota con la que arranca, p. ej. "Saldo inicial". */
  defaultNote?: string
  onDone: () => void
}

/** Anotar o corregir un movimiento de plata: valor, fecha, pedido (solo compras), medio y nota. */
export function CashMovementForm({ kind, movement, order, defaultNote, onDone }: CashMovementFormProps) {
  const id = useId()
  const orders = useOrders()
  const addMovement = useAddCashMovement()
  const updateMovement = useUpdateCashMovement()
  const deleteMovement = useDeleteCashMovement()
  const pending = addMovement.isPending || updateMovement.isPending
  const [orderQuery, setOrderQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CashValues>({
    resolver: zodResolver(cashSchema),
    defaultValues: movement
      ? {
          kind: movement.kind,
          amount: String(movement.amountCop),
          movedOn: movement.movedOn,
          orderId: movement.orderId,
          method: movement.method ?? '',
          note: movement.note ?? '',
        }
      : { kind, amount: '', movedOn: todayBogota(), orderId: order?.id ?? null, method: '', note: defaultNote ?? '' },
  })
  const currentKind = useWatch({ control, name: 'kind' })
  const orderId = useWatch({ control, name: 'orderId' })

  // Solo las compras se vinculan a un pedido.
  const withOrder = currentKind === 'reinversion'
  const listed = orders.data?.find((o) => o.id === orderId)
  const linkedOrder: FixedOrder | undefined =
    order ??
    (listed && {
      id: listed.id,
      customerName: listed.customerName,
      orderedOn: listed.orderedOn,
      costCop: listed.itemsCostCop,
    })

  const onSubmit = handleSubmit(async (values) => {
    const fields = {
      kind: values.kind,
      amountCop: parseCop(values.amount)!,
      movedOn: values.movedOn,
      orderId: values.kind === 'reinversion' ? values.orderId : null,
      method: values.method || null,
      note: values.note.trim() || null,
    }
    try {
      if (movement) await updateMovement.mutateAsync({ id: movement.id, ...fields })
      else await addMovement.mutateAsync(fields)
      toast.success(movement ? 'Movimiento actualizado' : 'Movimiento anotado')
      onDone()
    } catch (error) {
      toast.error(`No se pudo guardar: ${errorMessage(error)}`)
    }
  })

  const remove = async () => {
    if (!movement) return
    try {
      await deleteMovement.mutateAsync(movement.id)
      toast.success('Movimiento borrado')
      onDone()
    } catch (error) {
      toast.error(`No se pudo borrar: ${errorMessage(error)}`)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3 rounded-lg border p-3">
      <div>
        <h3 className="font-medium">{movement ? 'Corregir movimiento' : cashKindAction[currentKind].label}</h3>
        <p className="text-xs text-muted-foreground">{cashKindAction[currentKind].hint}</p>
      </div>

      {movement && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-kind`}>Tipo</Label>
          <NativeSelect id={`${id}-kind`} containerClassName="w-full" className="h-11 text-base" {...register('kind')}>
            {CASH_KINDS.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {cashKindAction[option].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Valor" prefix="$" error={errors.amount?.message} {...register('amount')} />
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-date`}>Fecha</Label>
          <Input id={`${id}-date`} type="date" className="h-11 text-base" {...register('movedOn')} />
        </div>
      </div>

      {withOrder && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-order`}>Pedido</Label>
          {linkedOrder ? (
            <div className="grid gap-1.5">
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3">
                <span className="min-w-0 truncate text-sm">
                  {linkedOrder.customerName} · {formatDate(linkedOrder.orderedOn)}
                </span>
                {!order && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground"
                    aria-label="Quitar el pedido"
                    onClick={() => setValue('orderId', null)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              {linkedOrder.costCop > 0 && (
                <button
                  type="button"
                  className="justify-self-start text-xs text-primary underline"
                  onClick={() => setValue('amount', String(linkedOrder.costCop), { shouldValidate: true })}
                >
                  Usar el costo calculado del pedido ({formatCop(linkedOrder.costCop)})
                </button>
              )}
            </div>
          ) : (
            <>
              <Autocomplete
                id={`${id}-order`}
                placeholder="Opcional · buscar por cliente"
                className="h-11 text-base"
                value={orderQuery}
                onValueChange={setOrderQuery}
                options={orders.data ?? []}
                getKey={(o) => o.id}
                getLabel={(o) => o.customerName}
                renderOption={(o) => (
                  <span className="flex justify-between gap-2">
                    <span className="truncate">{o.customerName}</span>
                    <span className="shrink-0 text-muted-foreground">{formatDate(o.orderedOn)}</span>
                  </span>
                )}
                onSelect={(o) => {
                  setValue('orderId', o.id)
                  setOrderQuery('')
                }}
              />
              <p className="text-xs text-muted-foreground">Si la compra es para un pedido, búscalo aquí.</p>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-method`}>Medio</Label>
          <NativeSelect id={`${id}-method`} containerClassName="w-full" className="h-11 text-base" {...register('method')}>
            <NativeSelectOption value="">Sin especificar</NativeSelectOption>
            {CASH_METHODS.map((method) => (
              <NativeSelectOption key={method} value={method}>
                {method}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-note`}>Nota</Label>
          <Input id={`${id}-note`} className="h-11 text-base" placeholder="Opcional" {...register('note')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-11" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      {movement && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-destructive"
          disabled={deleteMovement.isPending}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 />
          Borrar movimiento
        </Button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar este movimiento?"
        description="Sale del flujo de caja y el saldo se vuelve a calcular sin él."
        confirmLabel="Borrar"
        destructive
        onConfirm={() => void remove()}
      />
    </form>
  )
}

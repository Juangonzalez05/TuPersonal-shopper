import { UserPlus } from 'lucide-react'
import { useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { Customer } from '@/api/customers'
import { Autocomplete } from '@/components/Autocomplete'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPhone } from '@/lib/format'
import type { OrderFormValues } from '@/lib/order-form'
import { productKey } from '@/lib/product-name'

/** Elegir un cliente existente o escribir uno nuevo (nombre + WhatsApp) sin salir del pedido. */
export function CustomerPicker({ customers }: { customers: Customer[] }) {
  const { control, setValue, register, formState } = useFormContext<OrderFormValues>()
  const [customerId, customerName] = useWatch({ control, name: ['customerId', 'customerName'] })
  const phoneRef = useRef<HTMLInputElement | null>(null)

  const selected = customerId ? customers.find((c) => c.id === customerId) : undefined
  const isNew = !customerId && customerName.trim() !== ''
  const exactMatch = customers.some((c) => productKey(c.name) === productKey(customerName))
  const phoneField = register('customerPhone')

  return (
    <div className="grid gap-2">
      <Label htmlFor="customer">Cliente</Label>
      <Autocomplete
        id="customer"
        placeholder="Nombre o WhatsApp"
        className="h-12 text-base"
        value={customerName}
        aria-invalid={formState.errors.customerName ? true : undefined}
        options={customers}
        getKey={(c) => c.id}
        getLabel={(c) => c.name}
        getSearchText={(c) => `${c.name} ${c.phone ?? ''}`}
        renderOption={(c) => (
          <span className="flex items-baseline justify-between gap-2">
            <span>{c.name}</span>
            {c.phone && <span className="text-sm text-muted-foreground">{formatPhone(c.phone)}</span>}
          </span>
        )}
        onValueChange={(text) => {
          setValue('customerName', text, { shouldValidate: formState.isSubmitted })
          if (customerId) {
            setValue('customerId', null)
            setValue('customerPhone', '')
          }
        }}
        onSelect={(c) => {
          setValue('customerId', c.id)
          setValue('customerName', c.name, { shouldValidate: formState.isSubmitted })
          setValue('customerPhone', c.phone ?? '')
        }}
        extraOption={
          isNew && !exactMatch
            ? {
                label: (
                  <span className="flex items-center gap-2 font-medium">
                    <UserPlus className="size-4" />
                    Crear cliente «{customerName.trim()}»
                  </span>
                ),
                onSelect: () => setTimeout(() => phoneRef.current?.focus()),
              }
            : null
        }
      />
      {formState.errors.customerName && (
        <p className="text-sm text-destructive">{formState.errors.customerName.message}</p>
      )}

      {selected && (
        <p className="text-sm text-muted-foreground">
          {selected.phone ? `WhatsApp ${formatPhone(selected.phone)}` : 'Sin WhatsApp registrado'}
        </p>
      )}

      {isNew && (
        <div className="grid gap-1.5 rounded-md border border-dashed p-3">
          <Label htmlFor="customer-phone">WhatsApp del cliente nuevo (opcional)</Label>
          <Input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="300 123 4567"
            className="h-11 text-base"
            {...phoneField}
            ref={(element) => {
              phoneField.ref(element)
              phoneRef.current = element
            }}
          />
        </div>
      )}
    </div>
  )
}

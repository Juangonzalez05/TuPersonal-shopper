import { useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type NumberFieldProps = ComponentProps<typeof Input> & {
  label: string
  error?: string
  /** Texto fijo antes del número, p. ej. "$". */
  prefix?: string
  /** Texto fijo después del número, p. ej. "%". */
  suffix?: string
}

/** Campo numérico grande para el celular: teclado decimal, etiqueta y error. */
export function NumberField({ label, error, prefix, suffix, id, className, ...props }: NumberFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={cn('h-11 text-base tabular-nums', prefix && 'pl-7', suffix && 'pr-8', className)}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

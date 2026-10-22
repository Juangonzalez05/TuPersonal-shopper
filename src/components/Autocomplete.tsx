import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { matchesQuery } from '@/lib/search'
import { cn } from '@/lib/utils'

type AutocompleteProps<T> = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onSelect'> & {
  value: string
  onValueChange: (value: string) => void
  options: T[]
  getKey: (option: T) => string
  getLabel: (option: T) => string
  /** Texto donde se busca; por defecto la etiqueta. */
  getSearchText?: (option: T) => string
  renderOption?: (option: T) => ReactNode
  onSelect: (option: T) => void
  /** Opción adicional al final de la lista, p. ej. "Crear cliente «Ana»". */
  extraOption?: { label: ReactNode; onSelect: () => void } | null
  maxOptions?: number
}

/** Input con sugerencias debajo. Se elige tocando la opción o con flechas + Enter. */
export function Autocomplete<T>({
  value,
  onValueChange,
  options,
  getKey,
  getLabel,
  getSearchText = getLabel,
  renderOption,
  onSelect,
  extraOption,
  maxOptions = 6,
  onFocus,
  onBlur,
  onKeyDown,
  ...inputProps
}: AutocompleteProps<T>) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const matches =
    value.trim() === ''
      ? []
      : options.filter((option) => matchesQuery(getSearchText(option), value)).slice(0, maxOptions)
  const items = [
    ...matches.map((option) => ({
      key: getKey(option),
      content: renderOption ? renderOption(option) : getLabel(option),
      select: () => onSelect(option),
    })),
    ...(extraOption ? [{ key: '__extra', content: extraOption.label, select: extraOption.onSelect }] : []),
  ]
  const showList = open && items.length > 0
  const active = Math.min(highlight, items.length - 1)

  const choose = (index: number) => {
    items[index]?.select()
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        {...inputProps}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={(event) => {
          setOpen(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setOpen(false)
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (showList) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHighlight((active + 1) % items.length)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlight((active - 1 + items.length) % items.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              choose(active)
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }
          onKeyDown?.(event)
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {items.map((item, index) => (
            <li
              key={item.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cn('cursor-pointer rounded-sm px-3 py-2.5 text-base', index === active && 'bg-accent')}
              // Evita que el input pierda el foco (y cierre la lista) antes del clic.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(index)}
            >
              {item.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

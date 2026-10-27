import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCashFlow, type CashEntry } from '@/api/cash'
import { CashEntryRow, CashSourceIcon } from '@/components/cash/CashEntryRow'
import { CashMovementForm } from '@/components/cash/CashMovementForm'
import { SummaryCard, SummaryRow } from '@/components/summary/SummaryCard'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  buildCashFlow,
  cashKindAction,
  cashMonths,
  hasManualEntries,
  toCashMovement,
  type CashKind,
} from '@/lib/cash-flow'
import { errorMessage } from '@/lib/errors'
import { formatCop, formatDate, formatMonth, formatPercent, todayBogota } from '@/lib/format'
import { cn } from '@/lib/utils'

const ALL_MONTHS = 'todos'

/** Los cuatro botones, en el orden en que más se usan. */
const QUICK_KINDS: CashKind[] = ['reinversion', 'gasto', 'retiro', 'aporte']

type NewMovement = { kind: CashKind; note?: string }

/** Flujo de caja: cuánta plata tiene el negocio y todo lo que entra y sale. */
export function DineroPage() {
  const cash = useCashFlow()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState<NewMovement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (cash.isError) {
    return (
      <div className="grid gap-3 py-8 text-center">
        <p className="text-destructive">No se pudo cargar el flujo de caja: {errorMessage(cash.error)}</p>
        <Button variant="outline" onClick={() => void cash.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!cash.data) return <p className="py-8 text-center text-muted-foreground">Cargando flujo de caja…</p>

  const entries = cash.data
  const today = todayBogota()
  const monthParam = params.get('mes')
  const month =
    monthParam === ALL_MONTHS ? null : monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7)
  const balanceCop = buildCashFlow(entries, null, today).balanceCop
  const flow = buildCashFlow(entries, month, today)
  const startAdding = (movement: NewMovement) => {
    setEditingId(null)
    setAdding(movement)
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-1 rounded-lg bg-primary p-4 text-primary-foreground">
        <p className="text-sm opacity-80">Plata del negocio hoy</p>
        <p className={cn('text-3xl font-semibold tabular-nums', balanceCop < 0 && 'text-red-300')}>
          {formatCop(balanceCop)}
        </p>
        {balanceCop < 0 && (
          <p className="text-xs opacity-80">
            Salió más de lo que entró. Si pusiste plata de tu bolsillo, anótala en «Metí plata».
          </p>
        )}
      </section>

      {!hasManualEntries(entries) && !adding && (
        <section className="grid gap-2 rounded-lg border border-gold/60 p-3">
          <h2 className="font-medium">¿Con cuánta plata arranca el negocio?</h2>
          <p className="text-sm text-muted-foreground">
            Anota lo que tienes hoy para el negocio. Desde ahí se suman los abonos y se restan las compras, los
            envíos, los gastos y lo que saques para ti.
          </p>
          <Button className="h-11" onClick={() => startAdding({ kind: 'aporte', note: 'Saldo inicial' })}>
            Anotar saldo inicial
          </Button>
        </section>
      )}

      {adding ? (
        <CashMovementForm
          key={`${adding.kind}-${adding.note ?? ''}`}
          kind={adding.kind}
          defaultNote={adding.note}
          onDone={() => setAdding(null)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {QUICK_KINDS.map((kind) => (
            <Button
              key={kind}
              variant={kind === 'reinversion' ? 'default' : 'outline'}
              className="h-14 justify-start text-base"
              onClick={() => startAdding({ kind })}
            >
              <CashSourceIcon source={kind} className="size-5" />
              {cashKindAction[kind].label}
            </Button>
          ))}
        </div>
      )}

      <NativeSelect
        aria-label="Mes"
        containerClassName="w-full"
        className="h-11 text-base capitalize"
        value={month ?? ALL_MONTHS}
        onChange={(event) =>
          setParams(event.target.value === today.slice(0, 7) ? {} : { mes: event.target.value }, { replace: true })
        }
      >
        {cashMonths(entries, today).map((option) => (
          <NativeSelectOption key={option} value={option}>
            {formatMonth(option)}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={ALL_MONTHS}>Todos los meses</NativeSelectOption>
      </NativeSelect>

      <SummaryCard title={month ? 'En el mes' : 'En total'}>
        <SummaryRow label="Abonos de clientes" value={flow.bySource.abono} />
        <SummaryRow label="Plata que metí" value={flow.bySource.aporte} />
        <SummaryRow label="Entró" value={flow.inCop} strong />
        <SummaryRow label="Reinvertido (compras)" value={flow.bySource.reinversion} />
        <SummaryRow label="Envíos de cajas" value={flow.bySource.envio} />
        <SummaryRow label="Gastos" value={flow.bySource.gasto} />
        <SummaryRow label="Saqué para mí" value={flow.bySource.retiro} />
        <SummaryRow label="Salió" value={flow.outCop} strong />
        {flow.closedMonth && <SummaryRow label="Saldo al cierre del mes" value={flow.balanceCop} strong signed />}
      </SummaryCard>
      {flow.reinvestedShare !== null && (
        <p className="-mt-2 text-sm text-muted-foreground">
          De lo que cobraste {month ? 'este mes' : 'en total'}, reinvertiste el{' '}
          <span className="font-medium text-foreground">{formatPercent(Math.round(flow.reinvestedShare * 100) / 100)}</span>.
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="font-semibold">Movimientos</h2>
        {flow.days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay movimientos {month ? `en ${formatMonth(month)}` : 'todavía'}.
          </p>
        ) : (
          flow.days.map((day) => (
            <div key={day.date} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span>{formatDate(day.date)}</span>
                <span className="tabular-nums">
                  {day.netCop >= 0 ? '+' : '−'}
                  {formatCop(Math.abs(day.netCop))}
                </span>
              </div>
              <ul className="divide-y rounded-lg border">
                {day.entries.map((entry) => (
                  <li key={entry.id}>
                    {editingId === entry.id ? (
                      <EditEntry entry={entry} onDone={() => setEditingId(null)} />
                    ) : (
                      <CashEntryRow
                        entry={entry}
                        onEdit={(selected) => {
                          setAdding(null)
                          setEditingId(selected.id)
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function EditEntry({ entry, onDone }: { entry: CashEntry; onDone: () => void }) {
  const movement = toCashMovement(entry)
  if (!movement) return null
  return (
    <div className="p-2">
      <CashMovementForm kind={movement.kind} movement={movement} onDone={onDone} />
    </div>
  )
}

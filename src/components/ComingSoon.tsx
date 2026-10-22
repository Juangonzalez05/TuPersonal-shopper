import type { ReactNode } from 'react'

/** Marcador para las pantallas que llegan en fases siguientes del roadmap. */
export function ComingSoon({ phase, children }: { phase: number; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Próximamente · Fase {phase}</p>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

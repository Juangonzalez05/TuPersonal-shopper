import { LogOut } from 'lucide-react'
import { Outlet, useMatches } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { BottomNav } from './BottomNav'

/** Lo que cada ruta declara en `handle` para el encabezado. */
export type RouteHandle = { title: string }

export function AppLayout() {
  const { signOut } = useAuth()
  const matches = useMatches()
  const title =
    matches
      .map((match) => (match.handle as RouteHandle | undefined)?.title)
      .findLast(Boolean) ?? 'Tu Shopper USA'

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          <Button variant="ghost" size="sm" className="h-10" onClick={() => void signOut()}>
            <LogOut />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}

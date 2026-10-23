import { ArrowLeft, LogOut } from 'lucide-react'
import { Link, Outlet, useMatches, useNavigate, type Params } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { BottomNav } from './BottomNav'

/** Lo que cada ruta declara en `handle` para el encabezado. */
export type RouteHandle = {
  title: string
  /** Si existe, muestra "volver" (a la página anterior o, si no hay, a esta ruta). */
  back?: string | ((params: Params) => string)
}

export function AppLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const match = useMatches().findLast((m) => m.handle)
  const handle = match?.handle as RouteHandle | undefined
  const title = handle?.title ?? 'Tu Shopper USA'
  const back = typeof handle?.back === 'function' ? handle.back(match!.params) : handle?.back

  const goBack = () => {
    // React Router guarda la posición en el historial; idx 0 = se entró directo a esta URL.
    const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0
    if (canGoBack) navigate(-1)
    else if (back) navigate(back)
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {back ? (
              <Button variant="ghost" size="icon" className="-ml-2 size-10" aria-label="Volver" onClick={goBack}>
                <ArrowLeft className="size-5" />
              </Button>
            ) : (
              <Link to="/pedidos" className="shrink-0" aria-label="Tu Shopper USA, ir a Pedidos">
                <img src="/pwa-64x64.png" alt="" width={32} height={32} className="size-8 rounded-full" />
              </Link>
            )}
            <h1 className="truncate text-lg font-semibold text-primary">{title}</h1>
          </div>
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

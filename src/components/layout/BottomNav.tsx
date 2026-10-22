import { Boxes, ChartColumn, ClipboardList, Package, Plus, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Solo activo en la ruta exacta (Pedidos no se marca en /pedidos/nuevo). */
  end?: boolean
  /** Acción principal: botón redondo destacado. */
  primary?: boolean
}

const items: NavItem[] = [
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList, end: true },
  { to: '/pedidos/nuevo', label: 'Nuevo', icon: Plus, primary: true },
  { to: '/cajas', label: 'Cajas', icon: Package },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/resumen', label: 'Resumen', icon: ChartColumn },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
        {items.map(({ to, label, icon: Icon, end, primary }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {primary ? (
                    <span
                      className={cn(
                        'flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md',
                        isActive && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                      )}
                    >
                      <Icon className="size-6" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} />
                  )}
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

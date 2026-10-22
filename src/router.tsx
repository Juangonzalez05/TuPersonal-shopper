import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout, type RouteHandle } from '@/components/layout/AppLayout'
import { CajasPage } from '@/pages/CajasPage'
import { InventarioPage } from '@/pages/InventarioPage'
import { LoginPage } from '@/pages/LoginPage'
import { NuevoPedidoPage } from '@/pages/NuevoPedidoPage'
import { PedidosPage } from '@/pages/PedidosPage'
import { ResumenPage } from '@/pages/ResumenPage'

const title = (text: string): RouteHandle => ({ title: text })

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/pedidos" replace /> },
          { path: 'pedidos', element: <PedidosPage />, handle: title('Pedidos') },
          { path: 'pedidos/nuevo', element: <NuevoPedidoPage />, handle: title('Nuevo pedido') },
          { path: 'cajas', element: <CajasPage />, handle: title('Cajas') },
          { path: 'inventario', element: <InventarioPage />, handle: title('Inventario') },
          { path: 'resumen', element: <ResumenPage />, handle: title('Resumen') },
          { path: '*', element: <Navigate to="/pedidos" replace /> },
        ],
      },
    ],
  },
])

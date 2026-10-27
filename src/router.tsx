import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout, type RouteHandle } from '@/components/layout/AppLayout'
import { AgregarACajaPage } from '@/pages/AgregarACajaPage'
import { CajaDetallePage } from '@/pages/CajaDetallePage'
import { CajasPage } from '@/pages/CajasPage'
import { DineroPage } from '@/pages/DineroPage'
import { EditarPedidoPage } from '@/pages/EditarPedidoPage'
import { InventarioPage } from '@/pages/InventarioPage'
import { LoginPage } from '@/pages/LoginPage'
import { NuevoPedidoPage } from '@/pages/NuevoPedidoPage'
import { PedidoDetallePage } from '@/pages/PedidoDetallePage'
import { PedidosPage } from '@/pages/PedidosPage'
import { ProductoInventarioPage } from '@/pages/ProductoInventarioPage'
import { ResumenPage } from '@/pages/ResumenPage'

const handle = (title: string, back?: RouteHandle['back']): RouteHandle => ({ title, back })

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/pedidos" replace /> },
          { path: 'pedidos', element: <PedidosPage />, handle: handle('Pedidos') },
          { path: 'pedidos/nuevo', element: <NuevoPedidoPage />, handle: handle('Nuevo pedido') },
          { path: 'pedidos/:orderId', element: <PedidoDetallePage />, handle: handle('Pedido', '/pedidos') },
          {
            path: 'pedidos/:orderId/editar',
            element: <EditarPedidoPage />,
            handle: handle('Editar pedido', (params) => `/pedidos/${params.orderId}`),
          },
          { path: 'cajas', element: <CajasPage />, handle: handle('Cajas') },
          { path: 'cajas/:shipmentId', element: <CajaDetallePage />, handle: handle('Caja', '/cajas') },
          {
            path: 'cajas/:shipmentId/agregar',
            element: <AgregarACajaPage />,
            handle: handle('Agregar productos', (params) => `/cajas/${params.shipmentId}`),
          },
          { path: 'inventario', element: <InventarioPage />, handle: handle('Inventario') },
          {
            path: 'inventario/:productId',
            element: <ProductoInventarioPage />,
            handle: handle('Producto', '/inventario'),
          },
          { path: 'dinero', element: <DineroPage />, handle: handle('Flujo de caja') },
          { path: 'resumen', element: <ResumenPage />, handle: handle('Resumen') },
          { path: '*', element: <Navigate to="/pedidos" replace /> },
        ],
      },
    ],
  },
])

import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useOrder, useUpdateOrder } from '@/api/orders'
import { OrderForm } from '@/components/orders/OrderForm'
import { errorMessage } from '@/lib/errors'
import { orderToFormValues, toUpdateOrderArgs } from '@/lib/order-form'

/** Editar un pedido guardado: cliente, fecha, notas y productos. */
export function EditarPedidoPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  const order = useOrder(orderId)
  const updateOrder = useUpdateOrder()

  if (order.isPending) return <p className="py-8 text-center text-muted-foreground">Cargando pedido…</p>
  if (order.isError) {
    return <p className="py-8 text-center text-destructive">No se pudo cargar: {errorMessage(order.error)}</p>
  }
  if (!order.data) return <p className="py-8 text-center text-muted-foreground">Este pedido no existe.</p>

  return (
    <OrderForm
      mode="edit"
      defaultValues={orderToFormValues(order.data)}
      pending={updateOrder.isPending}
      submitLabel="Guardar cambios"
      onSubmit={async (values) => {
        try {
          await updateOrder.mutateAsync(toUpdateOrderArgs(orderId, values))
          toast.success('Pedido actualizado')
          navigate(`/pedidos/${orderId}`, { replace: true })
        } catch (error) {
          toast.error(`No se pudo guardar: ${errorMessage(error)}`)
        }
      }}
    />
  )
}

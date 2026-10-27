import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCreateOrder } from '@/api/orders'
import { OrderForm } from '@/components/orders/OrderForm'
import { errorMessage } from '@/lib/errors'
import { todayBogota } from '@/lib/format'
import { emptyOrder, toCreateOrderArgs } from '@/lib/order-form'

export function NuevoPedidoPage() {
  const navigate = useNavigate()
  const createOrder = useCreateOrder()

  return (
    <OrderForm
      mode="create"
      defaultValues={emptyOrder(todayBogota())}
      pending={createOrder.isPending}
      submitLabel="Guardar"
      onSubmit={async (values) => {
        try {
          const orderId = await createOrder.mutateAsync(toCreateOrderArgs(values))
          toast.success('Pedido guardado')
          navigate(`/pedidos/${orderId}`, { replace: true })
        } catch (error) {
          toast.error(`No se pudo guardar: ${errorMessage(error)}`)
        }
      }}
    />
  )
}

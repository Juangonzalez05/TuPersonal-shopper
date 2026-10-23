import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registra el service worker y, cuando hay una versión nueva publicada, ofrece actualizar.
 * No recarga sola: así no se pierde un pedido a medio escribir.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    const id = toast('Hay una versión nueva de la app', {
      duration: Infinity,
      action: { label: 'Actualizar', onClick: () => void updateServiceWorker(true) },
      onDismiss: () => setNeedRefresh(false),
    })
    return () => {
      toast.dismiss(id)
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  return null
}

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/auth/AuthProvider'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <Toaster position="top-center" richColors />
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
)

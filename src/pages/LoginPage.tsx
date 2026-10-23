import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, type Location } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const loginSchema = z.object({
  email: z.email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

type LoginValues = z.infer<typeof loginSchema>

// Sin enlace de registro: los usuarios se crean a mano en Supabase.
export function LoginPage() {
  const { session, signIn } = useAuth()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (session) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/pedidos'
    return <Navigate to={from} replace />
  }

  const onSubmit = async ({ email, password }: LoginValues) => {
    setFormError(null)
    setFormError(await signIn(email.trim(), password))
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-navy p-4">
      <img
        src="/pwa-512x512.png"
        alt="Tu Shopper USA"
        width={160}
        height={160}
        className="size-40 rounded-full shadow-lg shadow-black/40"
      />
      <Card className="w-full max-w-sm border-t-2 border-t-gold">
        <CardHeader>
          {/* El logo ya dice el nombre; el título queda para lectores de pantalla. */}
          <CardTitle className="sr-only">Tu Shopper USA</CardTitle>
          <CardDescription className="text-base text-foreground">Entra con tu correo y contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                className="h-12 text-base"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-12 text-base"
                aria-invalid={errors.password ? true : undefined}
                {...register('password')}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {formError && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" className="h-12 text-base" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

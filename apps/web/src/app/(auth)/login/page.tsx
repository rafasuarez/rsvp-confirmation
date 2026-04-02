'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = (form.get('email') as string | null) ?? ''
    const password = (form.get('password') as string | null) ?? ''

    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña')
      setLoading(false)
      return
    }

    try {
      await authApi.login(email, password)
      const raw = searchParams.get('redirect') ?? '/events'
      const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/events'
      router.push(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@ejemplo.com"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 p-8 bg-card rounded-xl shadow-sm border">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">RSVP Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de confirmaciones de asistencia
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}

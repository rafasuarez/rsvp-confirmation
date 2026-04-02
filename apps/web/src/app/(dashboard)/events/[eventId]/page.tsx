'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Send, BarChart3, Users, CheckCircle2, XCircle, Clock, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/status-badge'
import { eventsApi, guestsApi, rsvpApi, type Event, type Guest, type StatsResult } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type StatCardProps = { label: string; value: number; icon: React.ReactNode; color?: string }

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className={color}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [stats, setStats] = useState<StatsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    Promise.all([
      eventsApi.get(eventId),
      guestsApi.list(eventId),
      rsvpApi.stats(eventId),
    ])
      .then(([ev, gs, st]) => {
        setEvent(ev)
        setGuests(gs)
        setStats(st)
      })
      .catch(() =>
        toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [eventId])

  async function handleLaunch() {
    setLaunching(true)
    try {
      const result = await eventsApi.launch(eventId)
      setLaunchDialogOpen(false)
      toast({
        title: 'Campaña enviada',
        description: `Se han enviado mensajes a ${result.queued} invitados.`,
      })
      const newStats = await rsvpApi.stats(eventId)
      setStats(newStats)
    } catch (err) {
      toast({
        title: 'Error al lanzar campaña',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setLaunching(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">Cargando…</div>
    )
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Evento no encontrado.</p>
        <Button variant="link" onClick={() => router.push('/events')}>
          Volver a eventos
        </Button>
      </div>
    )
  }

  const pendingGuests = guests.filter((g) => g.isActive).length
  const canLaunch = pendingGuests > 0

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todos los eventos
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(event.eventDate)}
              {event.venue && ` · ${event.venue}`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/events/${eventId}/guests/import`}>
                <Upload className="h-4 w-4 mr-2" />
                Importar invitados
              </Link>
            </Button>
            <Button
              onClick={() => setLaunchDialogOpen(true)}
              disabled={!canLaunch}
              title={!canLaunch ? 'No hay invitados pendientes' : undefined}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar RSVP
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total invitados"
            value={stats.total}
            icon={<Users className="h-4 w-4" />}
            color="text-muted-foreground"
          />
          <StatCard
            label="Confirmados"
            value={stats.attending}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="text-green-600"
          />
          <StatCard
            label="Declinados"
            value={stats.declined}
            icon={<XCircle className="h-4 w-4" />}
            color="text-red-500"
          />
          <StatCard
            label="Sin respuesta"
            value={stats.pending}
            icon={<Clock className="h-4 w-4" />}
            color="text-orange-500"
          />
        </div>
      )}

      {/* Guest list + responses link */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Invitados ({guests.length})</h2>
          {guests.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/events/${eventId}/responses`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver respuestas
              </Link>
            </Button>
          )}
        </div>

        {guests.length === 0 ? (
          <div className="border rounded-lg p-10 text-center bg-card">
            <UserX className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Sin invitados todavía</p>
            <p className="text-xs text-muted-foreground mt-1">
              Importa una lista CSV para comenzar
            </p>
            <Button size="sm" variant="outline" className="mt-4" asChild>
              <Link href={`/events/${eventId}/guests/import`}>
                <Upload className="h-4 w-4 mr-2" />
                Importar invitados
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium">{guest.name}</TableCell>
                    <TableCell className="text-muted-foreground">{guest.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{guest.email ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge state="PENDING" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Launch confirmation dialog */}
      <Dialog open={launchDialogOpen} onOpenChange={setLaunchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Enviar mensajes RSVP?</DialogTitle>
            <DialogDescription>
              Estás a punto de enviar mensajes de WhatsApp a{' '}
              <strong>{pendingGuests} invitados</strong>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchDialogOpen(false)} disabled={launching}>
              Cancelar
            </Button>
            <Button onClick={handleLaunch} disabled={launching}>
              {launching ? 'Enviando…' : 'Sí, enviar mensajes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

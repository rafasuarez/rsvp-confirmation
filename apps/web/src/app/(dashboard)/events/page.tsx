'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { eventsApi, type Event } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/format'

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    eventsApi.list()
      .then(setEvents)
      .catch(() => toast({ title: 'Error', description: 'No se pudieron cargar los eventos', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)

    const form = new FormData(e.currentTarget)
    const dateValue = form.get('eventDate') as string

    try {
      const eventDate = new Date(dateValue)
      if (isNaN(eventDate.getTime())) {
        toast({ title: 'Fecha inválida', description: 'Por favor selecciona una fecha válida', variant: 'destructive' })
        return
      }
      const newEvent = await eventsApi.create({
        name: form.get('name') as string,
        eventDate: eventDate.toISOString(),
        venue: (form.get('venue') as string) || undefined,
        description: (form.get('description') as string) || undefined,
      })
      setEvents((prev) => [newEvent, ...prev])
      ;(e.target as HTMLFormElement).reset()
      setDialogOpen(false)
      toast({ title: 'Evento creado', description: newEvent.name })
    } catch (err) {
      toast({
        title: 'Error al crear evento',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus bodas y campañas de RSVP
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo evento
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Cargando…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Aún no tienes eventos</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea tu primer evento para comenzar a gestionar RSVPs
          </p>
          <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo evento
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center justify-between p-5 border rounded-lg bg-card hover:bg-accent/50 transition-colors group"
            >
              <div>
                <p className="font-medium">{event.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatDate(event.eventDate)}
                  {event.venue && ` · ${event.venue}`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {/* New Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
            <DialogDescription>
              Completa los datos de la boda. Podrás editar estos detalles más adelante.
            </DialogDescription>
          </DialogHeader>

          <form id="create-event-form" onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del evento *</Label>
              <Input id="name" name="name" required placeholder="Boda de Ana y Carlos" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eventDate">Fecha de la boda *</Label>
              <Input id="eventDate" name="eventDate" type="date" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue">Lugar (opcional)</Label>
              <Input id="venue" name="venue" placeholder="Hotel Gran Melia, Madrid" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Notas (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Información adicional para el equipo…"
                rows={3}
              />
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button type="submit" form="create-event-form" disabled={creating}>
              {creating ? 'Creando…' : 'Crear evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

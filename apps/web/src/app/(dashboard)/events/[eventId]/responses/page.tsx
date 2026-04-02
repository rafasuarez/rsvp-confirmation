'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import { rsvpApi, type GuestResponseRow, type StatsResult } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'attending', label: 'Confirmados' },
  { value: 'declined', label: 'Declinados' },
  { value: 'pending', label: 'Sin respuesta' },
  { value: 'opted_out', label: 'Baja voluntaria' },
]

const PAGE_SIZE = 50

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ResponsesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)

  const [rows, setRows] = useState<GuestResponseRow[]>([])
  const [stats, setStats] = useState<StatsResult | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const statusParam = status === 'all' ? undefined : status as 'attending' | 'declined' | 'pending' | 'opted_out'

    Promise.all([
      rsvpApi.list(eventId, { page, limit: PAGE_SIZE, status: statusParam }),
      rsvpApi.stats(eventId),
    ])
      .then(([data, st]) => {
        setRows(data.rows)
        setTotal(data.total)
        setStats(st)
      })
      .catch(() =>
        toast({ title: 'Error', description: 'No se pudieron cargar las respuestas', variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [eventId, page, status])

  function handleStatusChange(value: string) {
    setStatus(value)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al evento
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Respuestas RSVP</h1>
            {stats && (
              <p className="text-sm text-muted-foreground mt-1">
                {stats.attending} confirmados · {stats.declined} declinados · {stats.pending} sin respuesta
                {stats.optedOut > 0 && ` · ${stats.optedOut} bajas`}
              </p>
            )}
          </div>

          <Button variant="outline" asChild>
            <a href={rsvpApi.exportUrl(eventId)} download>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Filter + table */}
      <div className="space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {total} resultado{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acompañantes</TableHead>
                <TableHead>Dietética</TableHead>
                <TableHead>Respuesta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Sin resultados
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.guestId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.phone}</TableCell>
                    <TableCell>
                      <StatusBadge
                        state={row.conversationState}
                        isAttending={row.isAttending}
                      />
                    </TableCell>
                    <TableCell>
                      {row.confirmedPartySize !== null ? row.confirmedPartySize : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {row.dietaryNotes || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

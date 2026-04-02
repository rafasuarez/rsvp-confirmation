'use client'

import { useState, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { guestsApi, type ImportPreview } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'

type Step = 'upload' | 'preview' | 'done'

export default function ImportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo demasiado grande',
        description: 'El archivo no puede superar 5MB.',
        variant: 'destructive',
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    try {
      const data = await guestsApi.previewImport(eventId, file)
      setPreview(data)
      setStep('preview')
    } catch (err) {
      toast({
        title: 'Error al procesar el archivo',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setConfirming(true)

    try {
      const result = await guestsApi.confirmImport(eventId, preview.importBatch, preview.valid)
      setImportResult(result)
      setStep('done')
    } catch (err) {
      toast({
        title: 'Error al confirmar importación',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al evento
        </Link>
        <h1 className="text-2xl font-semibold">Importar invitados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube un archivo CSV con la lista de invitados.
        </p>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Paso 1 — Selecciona el archivo CSV</CardTitle>
            <CardDescription>
              El archivo debe tener columnas: <code className="text-xs bg-muted px-1 rounded">first_name</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">last_name</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">phone</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">email</code> (opcional).
              El teléfono se normaliza automáticamente a formato internacional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              htmlFor="csv-file"
              className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {uploading ? 'Procesando…' : 'Haz clic para seleccionar un archivo'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">CSV hasta 5MB</span>
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex gap-3 flex-wrap">
            <Badge variant="success" className="text-sm px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {preview.valid.length} válidos
            </Badge>
            {preview.invalid.length > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                {preview.invalid.length} con errores
              </Badge>
            )}
            {preview.duplicatePhones.length > 0 && (
              <Badge variant="warning" className="text-sm px-3 py-1">
                {preview.duplicatePhones.length} duplicados
              </Badge>
            )}
          </div>

          {/* Valid rows */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Invitados válidos ({preview.valid.length})
              </CardTitle>
              <CardDescription>
                Estos invitados serán importados al confirmar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {preview.valid.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Sin invitados válidos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono (E.164)</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.map((g) => (
                      <TableRow key={`${g.phone}-${g.name}`}>
                        <TableCell>{g.name}</TableCell>
                        <TableCell className="font-mono text-sm">{g.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{g.email ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Invalid rows (if any) */}
          {preview.invalid.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive">
                  Filas con errores ({preview.invalid.length}) — No se importarán
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Teléfono ingresado</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.invalid.map((r) => (
                      <TableRow key={r.row}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="font-mono text-sm">{r.rawPhone || '(vacío)'}</TableCell>
                        <TableCell className="text-destructive">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => { setStep('upload'); setPreview(null) }}
              disabled={confirming}
            >
              Subir otro archivo
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming || preview.valid.length === 0}
            >
              {confirming
                ? 'Importando…'
                : `Confirmar importación (${preview.valid.length} invitados)`}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && importResult && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <h2 className="text-xl font-semibold">¡Importación completada!</h2>
            <p className="text-muted-foreground mt-2">
              <strong>{importResult.imported}</strong> invitados importados correctamente.
              {importResult.skipped > 0 && (
                <> <strong>{importResult.skipped}</strong> omitidos (ya existían).</>
              )}
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Button variant="outline" onClick={() => { setStep('upload'); setImportResult(null) }}>
                Importar más
              </Button>
              <Button onClick={() => router.push(`/events/${eventId}`)}>
                Ver lista de invitados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

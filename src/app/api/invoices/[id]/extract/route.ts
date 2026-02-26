import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { extractInvoiceAndPersist } from '@/lib/invoices/extraction'
import { withExtractSlot } from '@/lib/invoices/extract-queue'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
    const extractorUrl = process.env.INVOICE_EXTRACTOR_API_URL
    if (!extractorUrl) {
      return NextResponse.json(
        { error: 'INVOICE_EXTRACTOR_API_URL no está configurada' },
        { status: 500 }
      )
    }

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

    // Determinar tipo y cliente (CIF empresa) desde invoice y upload
    let tipo: 'gasto' | 'ingreso' | undefined = undefined
    let cifEmpresa: string | null = null
    let nombreEmpresa: string | null = null
    let direccionEmpresa: string | null = null
    let proveedoresConocidos: { nombre: string; nif: string; direccion?: string; cp?: string; provincia?: string }[] = []
    
    try {
      const { data: invRow } = await supabase
        .from('invoices')
        .select('id, org_id, upload_id, client_id')
        .eq('id', invoiceId)
        .single()

      const uploadId = (invRow as { upload_id?: unknown })?.upload_id
      const clientId = (invRow as { client_id?: unknown })?.client_id
      if (typeof uploadId === 'string' && uploadId) {
        const { data: upRow } = await supabase
          .from('uploads')
          .select('id, org_id, tipo')
          .eq('id', uploadId)
          .single()

        const t = String((upRow as { tipo?: unknown })?.tipo || '').toLowerCase()
        if (t === 'gasto' || t === 'ingreso') tipo = t as 'gasto' | 'ingreso'
      }
      
      // Para GASTO, enviar CIF, nombre y dirección de la empresa (cliente) para guardrails
      if (tipo === 'gasto' && typeof clientId === 'string' && clientId) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('tax_id, name')
          .eq('id', clientId)
          .eq('org_id', orgId)
          .single()
        const row = clientRow as { tax_id?: string; name?: string } | null
        if (typeof row?.tax_id === 'string' && row.tax_id.trim()) cifEmpresa = row.tax_id.trim()
        if (typeof row?.name === 'string' && row.name.trim()) nombreEmpresa = row.name.trim()
        
        // Extraer los últimos proveedores usados por este cliente para ayudar a la IA
        const { data: recentSuppliers } = await supabase
          .from('suppliers')
          .select('name, tax_id, address, postal_code, province')
          .eq('client_id', clientId)
          .eq('org_id', orgId)
          .order('updated_at', { ascending: false })
          .limit(200)
          
        if (recentSuppliers) {
          const pMap = new Map<string, { nombre: string; nif: string; direccion?: string; cp?: string; provincia?: string }>()
          for (const s of recentSuppliers) {
            const nif = s.tax_id?.toUpperCase().trim()
            if (nif && nif !== cifEmpresa) { // Evitar meter a la propia empresa como proveedor conocido
              pMap.set(nif, {
                nombre: s.name?.trim() || '',
                nif: nif,
                direccion: s.address?.trim() || '',
                cp: s.postal_code?.trim() || '',
                provincia: s.province?.trim() || ''
              })
            }
          }
          proveedoresConocidos = Array.from(pMap.values())
        }
      }
    } catch {
      // noop
    }

    // Cola en backend: máximo 5 extracts en paralelo; el resto esperan
    const result = await withExtractSlot(() =>
      extractInvoiceAndPersist({
        supabase,
        userId: user.id,
        orgId,
        invoiceId,
        extractorUrl,
        tipo,
        cifEmpresa: cifEmpresa ?? undefined,
        nombreEmpresa: nombreEmpresa ?? undefined,
        direccionEmpresa: direccionEmpresa ?? undefined,
        proveedoresConocidos: proveedoresConocidos.length > 0 ? proveedoresConocidos : undefined,
      })
    )

    if (!result.ok) {
      const status = result.error === 'Factura no encontrada' ? 404 : result.error === 'Sin permisos' ? 403 : 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true, extraction: result.extraction, fields: result.fields }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en POST /api/invoices/[id]/extract:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}



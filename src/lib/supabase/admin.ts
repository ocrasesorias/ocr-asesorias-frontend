import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con Service Role (solo servidor).
 * Singleton: se crea una sola vez y se reutiliza entre peticiones.
 * Es seguro porque tiene persistSession: false y no depende de cookies.
 *
 * Úsalo únicamente después de comprobar permisos (org_id, invoice_id, etc.)
 * para generar signed URLs y operar sobre Storage sin depender de RLS.
 */
let _adminClient: SupabaseClient | null | undefined

export function createAdminClient(): SupabaseClient | null {
  // undefined = aún no inicializado, null = env vars ausentes
  if (_adminClient !== undefined) return _adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    _adminClient = null
    return null
  }

  _adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return _adminClient
}

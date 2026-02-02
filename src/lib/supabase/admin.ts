import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con Service Role (solo servidor).
 * Úsalo únicamente después de comprobar permisos (org_id, invoice_id, etc.)
 * para generar signed URLs y operar sobre Storage sin depender de RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}



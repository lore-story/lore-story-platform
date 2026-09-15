import { createClient } from '@supabase/supabase-js'

let client

export function getSupabaseClient() {
  if (typeof window !== 'undefined' && window.__LORE_SUPABASE__) return window.__LORE_SUPABASE__
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) throw new Error('Supabase ist nicht konfiguriert. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY in .env.local setzen.')
  client = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return client
}

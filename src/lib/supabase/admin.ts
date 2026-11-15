import "server-only";
import { createClient } from "@supabase/supabase-js";

// Solo catálogo verificado y transacciones de publicación, nunca sesiones del navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta la configuración privada del catálogo.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

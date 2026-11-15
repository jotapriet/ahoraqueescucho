export function getSupabaseEnv() {
  // Referencias estáticas para que Next pueda incluirlas en el bundle del navegador.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase.");
  return { url, key };
}

import "server-only";
import { cache } from "react";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type OAuthProvider = "google" | "apple";

// Consultar la configuración pública real evita ofrecer un acceso deshabilitado.
export const getOAuthProviders = cache(async (): Promise<OAuthProvider[]> => {
  try {
    const { url, key } = getSupabaseEnv();
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const settings = await response.json();
    return (["google", "apple"] as const).filter(provider => settings?.external?.[provider] === true);
  } catch { return []; }
});

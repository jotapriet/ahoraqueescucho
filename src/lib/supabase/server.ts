import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

// Un cliente por petición, nunca singleton con sesión compartida.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components no pueden escribir cookies; proxy.ts renueva la sesión.
        }
      },
    },
  });
}

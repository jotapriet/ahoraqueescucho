import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Nunca almacenar una respuesta que rote cookies de autenticación en una CDN.
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  // Valida la identidad con Auth y renueva tokens si procede; no confiar en getSession().
  await supabase.auth.getUser();
  return response;
}

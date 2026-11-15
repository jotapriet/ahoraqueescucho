import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/features/auth/redirects";

export async function GET(request: NextRequest) {
  const next = safeReturnTo(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  let verified = false;
  let needsIdentity = false;
  if (code && code.length <= 4096 && !request.nextUrl.searchParams.has("error")) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      verified = !error && !!data.user && !!data.session;
      if (verified && data.user) {
        const profile = await supabase.from("profiles").select("nick").eq("id", data.user.id).maybeSingle();
        needsIdentity = !!profile.error || !profile.data?.nick;
      }
    } catch { /* No exponer tokens, errores internos ni descripciones recibidas por URL. */ }
  }
  const failure = request.nextUrl.searchParams.has("error") ? "access-failed" : "invalid-link";
  const target = verified ? needsIdentity ? `/perfil?${new URLSearchParams({ next })}` : next : `/login?${new URLSearchParams({ error: failure, next })}`;
  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

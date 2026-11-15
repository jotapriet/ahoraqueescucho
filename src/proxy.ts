import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/session";

export async function proxy(request: NextRequest) {
  // La portada pública también debe poder verse antes de conectar Supabase.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

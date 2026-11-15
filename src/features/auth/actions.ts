"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { getOAuthProviders } from "./providers";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "./redirects";
import { getAuthOrigin } from "./origin";

type AuthResult = { ok: true } | { ok: false; message: string };
const emailSchema = z.string().trim().email().max(254);
export async function requestEmailLinkAction(input: unknown): Promise<AuthResult> {
  const parsed = z.object({ email: emailSchema, next: z.string().max(4096).optional() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: "Introduce un correo electrónico válido." };
  try {
    const supabase = await createClient();
    const callback = new URL("/auth/callback", await getAuthOrigin());
    callback.searchParams.set("next", safeReturnTo(parsed.data.next));
    const { error } = await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: true, emailRedirectTo: callback.href } });
    if (error) return { ok: false, message: "No hemos podido enviar el enlace. Espera un minuto y vuelve a intentarlo." };
    return { ok: true };
  } catch { return { ok: false, message: "El acceso no está disponible en este momento." }; }
}

export async function signOutAction(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { ok: false, message: "No se pudo cerrar la sesión. Vuelve a intentarlo." };
    return { ok: true };
  } catch { return { ok: false, message: "No se pudo cerrar la sesión. Vuelve a intentarlo." }; }
}
export async function signInWithOAuthAction(_previous: { message: string }, formData: FormData): Promise<{ message: string }> {
  const parsed = z.object({ provider: z.enum(["google", "apple"]), next: z.string().max(4096) }).safeParse({ provider: formData.get("provider"), next: formData.get("next") ?? "/aportar" });
  if (!parsed.success) return { message: "Este método de acceso no está disponible." };
  let destination: string;
  try {
    const enabled = await getOAuthProviders();
    if (!enabled.includes(parsed.data.provider)) return { message: "Este método de acceso todavía no está disponible. Puedes entrar con tu correo." };
    const supabase = await createClient();
    const callback = new URL("/auth/callback", await getAuthOrigin());
    callback.searchParams.set("next", safeReturnTo(parsed.data.next));
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: parsed.data.provider, options: { redirectTo: callback.href, skipBrowserRedirect: true } });
    if (error || !data.url) return { message: "No se pudo iniciar el acceso. Vuelve a intentarlo." };
    const url = new URL(data.url);
    if (url.origin !== new URL(getSupabaseEnv().url).origin || url.pathname !== "/auth/v1/authorize") return { message: "No se pudo iniciar el acceso de forma segura." };
    destination = url.href;
  } catch { return { message: "El acceso no está disponible en este momento." }; }
  redirect(destination);
}

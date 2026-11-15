import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContributionForm } from "@/components/contributions/contribution-form";
import { getCatalogProvider } from "@/features/contributions/config";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/features/auth/session";

export const metadata = { title: "Aportar a la colección · Ahora qué escucho" };

export default async function ContributePage() {
  const { available: authAvailable, viewer } = await getAuthState();
  const publishingAvailable = authAvailable && !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const signedIn = !!viewer;
  let needsNick = false;
  if (viewer) {
    const supabase = await createClient();
    const profile = await supabase.from("profiles").select("nick").eq("id", viewer.id).maybeSingle();
    needsNick = !profile.error && !profile.data?.nick;
  }
  return <main id="main-content" className="site-container pb-16 pt-8 sm:pt-10"><Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a descubrir</Link><div className="mb-9"><p className="eyebrow mb-3">DE TU ESTANTERÍA A LA DE ALGUIEN MÁS</p><h1 className="text-[36px] leading-tight tracking-tight sm:text-[48px]">Comparte ese disco que se queda.</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">No hace falta ser crítico musical. Solo haber sentido algo y querer que alguien más lo descubra.</p></div>{needsNick && <p className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-sm">Antes de publicar, <Link href="/perfil" className="font-semibold text-primary underline">elige tu nick definitivo en Mi perfil</Link>. Será la firma de tus recomendaciones.</p>}<ContributionForm provider={getCatalogProvider()} signedIn={signedIn} authAvailable={authAvailable} publishingAvailable={publishingAvailable} /></main>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark, Disc3, HeartHandshake, ThumbsUp } from "lucide-react";
import { SocialAccess } from "@/components/auth/social-access";
import { getOAuthProviders } from "@/features/auth/providers";
import { EmailAccess } from "@/components/auth/email-access";
import { getAuthState } from "@/features/auth/session";
import { safeReturnTo } from "@/features/auth/redirects";
import type { SearchParams } from "@/features/discovery/filters";

export const metadata = { title: "Entrar · Ahora qué escucho", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const next = safeReturnTo(params.next);
  const { available, viewer } = await getAuthState();
  if (viewer) redirect(viewer.nick === null && next !== "/perfil" ? `/perfil?${new URLSearchParams({ next })}` : next);
  const providers = available ? await getOAuthProviders() : [];
  const error = params.error === "invalid-link" ? "El enlace no es válido o ha caducado. Solicita otro y ábrelo en este mismo navegador." : params.error === "access-failed" ? "El acceso no se ha completado. Puedes volver a intentarlo o entrar con tu correo." : "";
  return <main id="main-content" className="site-container pb-16 pt-8 sm:pt-10"><Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="size-4" />Volver a la tienda</Link>
    <div className="grid items-center gap-10 pb-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-20"><section><p className="eyebrow mb-5">AQUÍ, TU BUEN GUSTO TIENE NOMBRE</p><h1 className="max-w-xl text-[40px] leading-[1.08] tracking-[-.035em] sm:text-[56px]">Lo mejor de la música<br className="hidden sm:block" /> es <em className="font-normal text-primary">compartirla.</em></h1><p className="mt-6 max-w-md text-sm leading-[1.9] text-muted-foreground">Pasa al otro lado del mostrador. Guarda lo que quieres escuchar y recomienda lo que no te puedes guardar.</p><div className="my-8 hidden space-y-4 lg:block">{[{ Icon: Disc3, title: "Ponle tu firma a un disco", text: "Tu experiencia puede ser el próximo gran descubrimiento de alguien." }, { Icon: Bookmark, title: "Déjalo para otra tarde", text: "Guarda álbumes en tus pendientes de escuchar." }, { Icon: ThumbsUp, title: "Reconoce una buena recomendación", text: "Cada Acertado suma a quienes comparten su música." }].map(({ Icon, title, text }) => <div key={title} className="flex gap-3"><Icon className="mt-1 size-4 shrink-0 text-secondary" strokeWidth={1.5} /><div><h2 className="font-sans text-xs font-semibold">{title}</h2><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{text}</p></div></div>)}</div><p className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground lg:flex"><HeartHandshake className="size-4 text-primary" />De persona a persona. De la primera a la última pista.</p></section>
      <div>{!available && <p className="mb-4 rounded-md border bg-card/50 p-4 text-xs leading-relaxed text-muted-foreground">El acceso a la colección todavía no está disponible. Puedes seguir descubriendo y volver a intentarlo más tarde.</p>}<SocialAccess providers={providers} next={next} disabled={!available} /><EmailAccess key={error || "login"} standalone redirectTo={next} disabled={!available} initialError={error} /></div>
    </div>
  </main>;
}

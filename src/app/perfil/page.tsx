import { CollectionList } from "@/components/collections/collection-list";
import { collectionPage } from "@/features/collections/queries";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Disc3, ArrowUpRight } from "lucide-react";
import { z } from "zod";
import { getAuthState } from "@/features/auth/session";
import { loginHref } from "@/features/auth/redirects";
import { safeReturnTo } from "@/features/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { safeCoverUrl } from "@/lib/music/urls";
import { Button } from "@/components/ui/button";
import { ListeningEditor } from "@/components/profile/listening-editor";
import { ListeningHistory } from "@/components/profile/listening-history";
import { RemoveSaved } from "@/components/profile/remove-saved";

import { IdentityEditor } from "@/components/profile/identity-editor";
import { Avatar } from "@/components/profile/avatar";
import { Contributions } from "@/components/profile/contributions";

export const metadata = { title: "Mi perfil · Ahora qué escucho" };
const rowsSchema = z.array(z.object({ albums: z.object({ id: z.uuid(), title: z.string(), artists: z.array(z.string()), release_year: z.number().nullable(), cover_url: z.string().nullable(), source_url: z.string() }) }));
const pageSize = 24;

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ page?: string; colecciones?: string; aportaciones?: string; escuchados?: string; next?: string }> }) {
  const { viewer } = await getAuthState();
  if (!viewer) redirect(loginHref("/perfil"));
  const params = await searchParams;
  const supabaseProfile = await createClient();
  const profileResponse = await supabaseProfile.from("profiles").select("nick,avatar_url").eq("id", viewer.id).single();
  if (profileResponse.error) throw new Error("No se pudo cargar tu perfil. Inténtalo de nuevo.");
  const profile = profileResponse.data;
  const contributionValue = Number(params.aportaciones);
  const contributionPage = Number.isSafeInteger(contributionValue) && contributionValue > 0 && contributionValue <= 10000 ? contributionValue : 1;
  const historyValue = Number(params.escuchados);
  const historyPage = Number.isSafeInteger(historyValue) && historyValue > 0 && historyValue <= 10000 ? historyValue : 1;
  const pageNumber = Number(params.page);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 10000 ? pageNumber : 1;
  let rows: z.infer<typeof rowsSchema> = [];
  let total = 0;
  let failed = false;
  try {
    const supabase = await createClient();
    const response = await supabase.from("saved_albums")
      .select("albums!inner(id,title,artists,release_year,cover_url,source_url)", { count: "exact" })
      .eq("user_id", viewer.id).order("created_at", { ascending: false }).order("album_id")
      .range((page - 1) * pageSize, page * pageSize - 1);
    const parsed = rowsSchema.safeParse(response.data);
    if (response.error || !parsed.success) failed = true;
    else { rows = parsed.data; total = response.count ?? 0; }
  } catch { failed = true; }
  return <main id="main-content" className="site-container pb-16 pt-10">
    <div className="flex items-center gap-4"><Avatar userId={viewer.id} url={profile.avatar_url} nick={profile.nick ?? "Curador"} /><div className="min-w-0"><p className="eyebrow mb-2">MI ESTANTERÍA</p><h1 className="break-words text-3xl sm:text-4xl">{profile.nick ? `@${profile.nick}` : "Ponle una firma a tu selección."}</h1>{profile.nick && <Link href={`/curadores/${profile.nick}`} className="mt-2 inline-block text-xs text-primary underline">Ver mi perfil público</Link>}</div></div>
    <IdentityEditor nick={profile.nick} />
    {profile.nick && params.next && safeReturnTo(params.next) !== "/perfil" && <Button asChild variant="outline"><Link href={safeReturnTo(params.next)}>Continuar donde lo dejé<ArrowUpRight /></Link></Button>}
    <CollectionList userId={viewer.id} page={collectionPage(params.colecciones)} basePath="/perfil" own />
    <Contributions userId={viewer.id} page={contributionPage} basePath="/perfil" own />
    <nav aria-label="Tu biblioteca privada" className="mt-10 flex flex-wrap gap-4 text-sm"><Link href="#pendientes" className="text-primary underline underline-offset-4">Pendientes</Link><Link href="#escuchados" className="text-primary underline underline-offset-4">Historial de escuchas</Link></nav>
    <section id="pendientes" className="scroll-mt-8" aria-labelledby="pending-title">
    <p className="eyebrow mb-3 mt-8">SOLO TÚ PUEDES VER ESTA LISTA</p>
    <h2 id="pending-title" className="text-3xl tracking-tight">Pendientes de escuchar.</h2>
    <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Esos discos que esperan su momento. Ponte cómodo y elige por dónde empezar.</p>
    {!failed && <p className="mt-6 font-mono text-xs text-secondary">{total} {total === 1 ? "DISCO GUARDADO" : "DISCOS GUARDADOS"}</p>}
    {failed ? <section role="alert" className="mt-8 rounded-xl border bg-card p-8"><h2 className="text-2xl">Tu estantería no ha podido cargar.</h2><p className="my-4 text-sm text-muted-foreground">Tus pendientes siguen guardados. Vuelve a intentarlo.</p><Button asChild variant="outline"><Link href={`/perfil?page=${page}`}>Reintentar</Link></Button></section>
    : !rows.length ? <section className="mt-8 rounded-xl border bg-card/40 px-6 py-14 text-center"><Bookmark className="mx-auto mb-5 size-9 text-primary" strokeWidth={1.5} /><h2 className="text-3xl">{total ? "No hay discos en esta página." : "Tu próxima escucha empieza aquí."}</h2><p className="mx-auto my-5 max-w-md text-sm leading-relaxed text-muted-foreground">{total ? "Vuelve al principio de tu estantería." : "Cuando un disco te llame la atención, pulsa «Guardar en pendientes». Lo encontrarás en esta estantería."}</p><Button asChild><Link href={total ? "/perfil" : "/#tu-momento"}>{total ? "Ver mis pendientes" : "Descubrir un disco"}</Link></Button></section>
    : <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map(({ albums: album }) => {
      const cover = safeCoverUrl(album.cover_url ?? undefined);
      return <article key={album.id} className="min-w-0 rounded-xl border bg-card/50 p-5"><Link href={`/albumes/${album.id}`} aria-label={`Dónde escuchar ${album.title}`} className="album-sleeve block aspect-square rounded-md bg-muted">{cover ? <img src={cover} alt={`Portada de ${album.title}`} loading="lazy" className="album-cover size-full" /> : <div className="flex h-full items-center justify-center"><Disc3 className="size-16 text-muted-foreground" strokeWidth={1} /></div>}</Link><h2 className="mt-5 break-words font-serif text-xl"><Link href={`/albumes/${album.id}`} className="hover:text-primary">{album.title}</Link></h2><p className="mt-1 text-sm text-muted-foreground">{album.artists.join(", ")}</p><p className="mb-4 mt-2 font-mono text-xs text-muted-foreground">{album.release_year ?? "Año desconocido"}</p><Button asChild variant="outline" className="mb-2 w-full"><Link href={`/albumes/${album.id}`}>Dónde escucharlo<ArrowUpRight className="size-4" /></Link></Button><ListeningEditor albumId={album.id} title={album.title} /><RemoveSaved albumId={album.id} title={album.title} /></article>;
    })}</div>}
    {!failed && total > pageSize && <nav aria-label="Páginas de pendientes" className="mt-9 flex items-center justify-center gap-4">{page > 1 && <Link className="text-sm underline" href={`/perfil?page=${page - 1}`}>Anterior</Link>}<span className="font-mono text-xs">Página {page} de {Math.ceil(total / pageSize)}</span>{page * pageSize < total && <Link className="text-sm underline" href={`/perfil?page=${page + 1}`}>Siguiente</Link>}</nav>}
    </section>
    <ListeningHistory userId={viewer.id} page={historyPage} />
  </main>;
}

import { RecommendationEditor } from "@/components/contributions/recommendation-editor";
import { recommendationChanges } from "@/features/contributions/manage-schema";
import Link from "next/link";
import { z } from "zod";
import { ArrowUpRight, Disc3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeCoverUrl } from "@/lib/music/urls";

const schema = z.array(z.object({ id: z.uuid(), ...recommendationChanges.shape, albums: z.object({ id: z.uuid(), title: z.string(), artists: z.array(z.string()), release_year: z.number().nullable(), cover_url: z.string().nullable(), source_url: z.string() }) }));
export async function Contributions({ userId, page = 1, basePath, own = false }: { userId: string; page?: number; basePath: string; own?: boolean }) {
  let rows: z.infer<typeof schema> = [];
  let total = 0;
  let failed = false;
  try {
    const supabase = await createClient();
    const response = await supabase.from("recommendations").select("id,comment,contexts,energy,moods,language,albums!inner(id,title,artists,release_year,cover_url,source_url)", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).order("id").range((page - 1) * 12, page * 12 - 1);
    const parsed = schema.safeParse(response.data);
    if (response.error || !parsed.success) failed = true;
    else { rows = parsed.data; total = response.count ?? rows.length; }
  } catch { failed = true; }
  const href = (value: number) => `${basePath}?aportaciones=${value}#aportaciones`;
  return <section id="aportaciones" className="my-10 scroll-mt-8" aria-labelledby="contributions-title"><div className="mb-5 flex flex-wrap items-baseline justify-between gap-3"><h2 id="contributions-title" className="text-3xl">{own ? "Tus aportaciones" : "Discos aportados"}</h2>{!failed && <p className="font-mono text-xs text-muted-foreground">{total} {total === 1 ? "DISCO" : "DISCOS"} · COLECCIÓN PÚBLICA</p>}</div>
    {failed ? <p role="alert" className="rounded-lg border p-6 text-sm text-muted-foreground">No se pudieron cargar las aportaciones. <Link href={href(page)} className="text-primary underline">Reintentar</Link></p> : !rows.length ? <div className="rounded-lg border bg-card/30 p-8 text-sm text-muted-foreground">{total ? <Link href={href(1)} className="text-primary underline">Volver a la primera página</Link> : own ? <>Todavía no has aportado ningún disco. <Link href="/aportar" className="text-primary underline">Comparte tu primera recomendación.</Link></> : "Este curador todavía no ha aportado discos."}</div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.map(row => {
      const album = row.albums;
      const cover = safeCoverUrl(album.cover_url ?? undefined);
      return <article key={row.id} className="min-w-0 rounded-xl border bg-card/40 p-5"><Link href={`/albumes/${album.id}`} aria-label={`Dónde escuchar ${album.title}`} className="album-sleeve mb-5 block aspect-square rounded-md bg-muted">{cover ? <img src={cover} alt={`Portada de ${album.title}`} loading="lazy" className="album-cover" /> : <div className="flex h-full items-center justify-center"><Disc3 className="size-14 text-muted-foreground" /></div>}</Link><h3 className="break-words text-xl"><Link href={`/albumes/${album.id}`} className="hover:text-primary">{album.title}</Link></h3><p className="mt-1 text-sm text-muted-foreground">{album.artists.join(", ")}</p><p className="mt-2 font-mono text-xs text-muted-foreground">{album.release_year ?? "Año desconocido"}</p><blockquote className="my-4 break-words font-serif text-lg leading-relaxed">«{row.comment}»</blockquote><Link href={`/albumes/${album.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Dónde escucharlo<ArrowUpRight className="size-3.5" /></Link>{own && <RecommendationEditor recommendationId={row.id} initial={{ comment: row.comment, contexts: row.contexts, energy: row.energy, moods: row.moods, language: row.language }} />}</article>;
    })}</div>}
    {!failed && total > 12 && <nav aria-label="Páginas de aportaciones" className="mt-6 flex justify-center gap-4 text-sm">{page > 1 && <Link href={href(page - 1)} className="underline">Anterior</Link>}<span className="font-mono text-xs">Página {page} de {Math.ceil(total / 12)}</span>{page * 12 < total && <Link href={href(page + 1)} className="underline">Siguiente</Link>}</nav>}
  </section>;
}

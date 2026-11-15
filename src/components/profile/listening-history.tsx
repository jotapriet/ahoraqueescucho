import Link from "next/link";
import { z } from "zod";
import { Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { safeCoverUrl } from "@/lib/music/urls";
import { AlbumArtwork } from "@/components/album-artwork";
import { ListeningEditor } from "./listening-editor";

const schema = z.array(z.object({ listened_on: z.iso.date(), note: z.string().nullable(), albums: z.object({ id: z.uuid(), title: z.string(), artists: z.array(z.string()), cover_url: z.string().nullable() }) }));
const pageSize = 12;

export async function ListeningHistory({ userId, page }: { userId: string; page: number }) {
  let rows: z.infer<typeof schema> = [];
  let total = 0;
  let failed = false;
  try {
    const supabase = await createClient();
    const response = await supabase.from("listened_albums").select("listened_on,note,albums!inner(id,title,artists,cover_url)", { count: "exact" })
      .eq("user_id", userId).order("listened_on", { ascending: false }).order("album_id")
      .range((page - 1) * pageSize, page * pageSize - 1);
    const parsed = schema.safeParse(response.data);
    if (response.error || !parsed.success) failed = true;
    else { rows = parsed.data; total = response.count ?? rows.length; }
  } catch { failed = true; }
  const href = (value: number) => `/perfil?escuchados=${value}#escuchados`;
  return <section id="escuchados" className="mt-14 scroll-mt-8 border-t pt-10" aria-labelledby="history-title"><p className="eyebrow mb-3">TU DIARIO DE ESCUCHAS · SOLO PARA TI</p><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="history-title" className="text-3xl">Ya escuchados.</h2>{!failed && <p className="font-mono text-xs text-secondary">{total} {total === 1 ? "DISCO ESCUCHADO" : "DISCOS ESCUCHADOS"}</p>}</div><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Discos que ya han pasado por tus oídos, con la fecha y lo que te dejaron. Tus notas nunca aparecen en tu perfil público.</p>
    {failed ? <p role="alert" className="mt-6 rounded-lg border bg-card/30 p-6 text-sm">No se pudo cargar tu historial. <Link href={href(page)} className="text-primary underline">Reintentar</Link></p> : !rows.length ? <div className="mt-6 rounded-xl border bg-card/30 p-8 text-center"><Headphones className="mx-auto mb-4 size-8 text-secondary" strokeWidth={1.5} /><p className="font-serif text-2xl">{total ? "No hay escuchas en esta página." : "Cada disco deja algo."}</p><p className="mt-3 text-sm text-muted-foreground">{total ? <Link href={href(1)} className="text-primary underline">Volver a la primera página</Link> : <>Marca «Ya lo he escuchado» en tus <Link href="#pendientes" className="text-primary underline">pendientes</Link> para empezar tu diario.</>}</p></div> : <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.map(row => <article key={row.albums.id} className="min-w-0 rounded-xl border bg-card/40 p-5"><Link href={`/albumes/${row.albums.id}`} className="album-sleeve block"><AlbumArtwork url={safeCoverUrl(row.albums.cover_url ?? undefined)} title={row.albums.title} /></Link><h3 className="mt-5 break-words text-xl"><Link href={`/albumes/${row.albums.id}`} className="hover:text-primary">{row.albums.title}</Link></h3><p className="mt-1 text-sm text-muted-foreground">{row.albums.artists.join(", ")}</p><p className="mt-4 font-mono text-[11px] text-secondary">ESCUCHADO EL <time dateTime={row.listened_on}>{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${row.listened_on}T12:00:00Z`))}</time></p>{row.note && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{row.note}</p>}<ListeningEditor albumId={row.albums.id} title={row.albums.title} initial={{ listenedOn: row.listened_on, note: row.note }} /></article>)}</div>}
    {!failed && total > pageSize && <nav aria-label="Páginas del historial" className="mt-7 flex justify-center gap-4 text-sm">{page > 1 && <Link href={href(page - 1)} className="underline">Anterior</Link>}<span className="font-mono text-xs">Página {page} de {Math.ceil(total / pageSize)}</span>{page * pageSize < total && <Link href={href(page + 1)} className="underline">Siguiente</Link>}</nav>}
  </section>;
}

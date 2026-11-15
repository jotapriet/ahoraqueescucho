import { ArrowUpRight, Headphones, Search } from "lucide-react";
import { getListeningLinks, platformNames, platformSearches, type ListeningAlbum } from "@/features/music/listening";

export async function ListeningPlatforms({ album }: { album: ListeningAlbum }) {
  const links = await getListeningLinks(album);
  const entries = Object.entries(links) as Array<[keyof typeof platformNames, string]>;
  return <section aria-labelledby="platforms-title" className="rounded-xl border bg-card/40 p-6 sm:p-8"><Headphones className="mb-5 size-7 text-secondary" strokeWidth={1.5} /><p className="eyebrow mb-3">DE LA PRIMERA A LA ÚLTIMA PISTA</p><h2 id="platforms-title" className="text-3xl">Escúchalo a tu manera.</h2><p className="mb-6 mt-4 text-sm leading-relaxed text-muted-foreground">Elige tu plataforma y dale tiempo al disco entero.</p>
    {entries.length ? <div className="grid gap-3">{entries.map(([platform, url]) => <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-md border bg-background px-4 py-3 text-sm font-semibold hover:border-primary hover:bg-primary/5">{platformNames[platform]}<ArrowUpRight className="size-4" /><span className="sr-only">(nueva pestaña)</span></a>)}</div> : <p className="text-sm text-muted-foreground">Todavía no hemos encontrado enlaces directos confirmados para este álbum.</p>}
    <details className="mt-7 border-t pt-5" open={!entries.length}><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">¿No está tu plataforma? Buscar el álbum</summary><p className="my-3 text-[11px] leading-relaxed text-muted-foreground">Estas opciones abren una búsqueda. No confirman que el álbum esté disponible en esa plataforma o en tu país.</p><div className="flex flex-wrap gap-2">{platformSearches(album.title, album.artists).map(item => <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-xs hover:border-primary"><Search className="size-3" />{item.name}</a>)}</div></details>
  </section>;
}

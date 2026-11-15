"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlbumArtwork } from "@/components/album-artwork";
import { saveCollectionAction, searchCollectionAlbumsAction } from "@/features/collections/actions";
import { collectionInput, type CollectionAlbum, type CollectionDraft } from "@/features/collections/schema";

export function CollectionEditor({ initial }: { initial: CollectionDraft }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [introduction, setIntroduction] = useState(initial.introduction);
  const [albums, setAlbums] = useState(initial.albums);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollectionAlbum[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(true);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const request = useRef(0);
  useEffect(() => {
    const version = ++request.current;
    setSearching(true); setSearchError("");
    const timer = setTimeout(async () => {
      try {
        const result = await searchCollectionAlbumsAction({ query });
        if (version !== request.current) return;
        if (result.ok) setResults(result.albums);
        else { setResults([]); setSearchError(result.message); }
      } catch { if (version === request.current) { setResults([]); setSearchError("No se pudieron buscar discos."); } }
      finally { if (version === request.current) setSearching(false); }
    }, 300);
    return () => { clearTimeout(timer); request.current++; };
  }, [query]);
  function move(index: number, direction: number) {
    setAlbums(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  return <form onSubmit={event => {
    event.preventDefault(); setMessage("");
    const input = { id: initial.id, title, introduction, albumIds: albums.map(album => album.id) };
    if (!collectionInput.safeParse(input).success) { setMessage("Añade un título de 3 a 100 caracteres, una introducción y entre 2 y 12 discos distintos."); return; }
    startTransition(async () => {
      try { const result = await saveCollectionAction(input); if (!result.ok) setMessage(result.message); else { router.push(`/colecciones/${result.id}`); router.refresh(); } }
      catch { setMessage("No se pudo publicar. Tu selección sigue aquí; puedes reintentarlo."); }
    });
  }} className="mt-8 space-y-8">
    <fieldset disabled={pending} className="space-y-6 disabled:opacity-60">
      <label className="block text-sm font-semibold">Título<input required minLength={3} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Cinco discos para una tarde de lluvia" className="mt-2 block w-full rounded-md border bg-background p-3 font-serif text-xl" /></label>
      <label className="block text-sm font-semibold">Una pequeña introducción<textarea required maxLength={1000} rows={4} value={introduction} onChange={event => setIntroduction(event.target.value)} placeholder="Cuenta qué une a estos discos y cuándo te gusta escucharlos…" className="mt-2 block w-full rounded-md border bg-background p-3 text-sm font-normal leading-relaxed" /><span className="mt-2 block text-right font-mono text-xs font-normal text-muted-foreground">{[...introduction].length}/1000</span></label>
      <section aria-labelledby="selection-title"><h2 id="selection-title" className="text-2xl">El orden también cuenta.</h2><p className="mb-4 mt-2 text-sm text-muted-foreground">Elige entre 2 y 12 discos de la colección y ordénalos a tu manera. {albums.length}/12 seleccionados.</p>
        <ol className="space-y-3">{albums.map((album, index) => <li key={album.id} className="flex items-center gap-3 rounded-lg border bg-card p-3"><span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</span><AlbumArtwork url={album.cover_url} title={album.title} className="size-12 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="break-words font-serif">{album.title}</p><p className="text-xs text-muted-foreground">{album.artists.join(", ")}</p></div><div className="flex shrink-0 flex-col sm:flex-row"><Button type="button" variant="ghost" size="icon" disabled={index === 0} aria-label={`Subir ${album.title}`} onClick={() => move(index, -1)}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon" disabled={index === albums.length - 1} aria-label={`Bajar ${album.title}`} onClick={() => move(index, 1)}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${album.title}`} onClick={() => setAlbums(current => current.filter(item => item.id !== album.id))}><X /></Button></div></li>)}</ol>
        {!albums.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Tu selección empieza con un disco.</p>}
      </section>
      <section><label className="block text-sm font-semibold">Buscar en los discos aportados<input type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} placeholder="Título o artista" className="my-3 block w-full rounded-md border bg-background p-3 font-normal" /></label>
        <div aria-live="polite">{searching ? <p className="text-sm text-muted-foreground">Buscando discos…</p> : searchError ? <p role="alert" className="text-sm text-primary">{searchError}</p> : !results.length ? <p className="text-sm text-muted-foreground">No hay discos con esa búsqueda. Puedes aportar uno desde «Aportar a la colección».</p> : <ul className="grid gap-2 sm:grid-cols-2">{results.map(album => { const selected = albums.some(item => item.id === album.id); return <li key={album.id} className="flex items-center gap-3 rounded-lg border p-3"><AlbumArtwork url={album.cover_url} title={album.title} className="size-12 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="break-words font-serif">{album.title}</p><p className="text-xs text-muted-foreground">{album.artists.join(", ")}</p></div><Button type="button" size="icon" variant="outline" disabled={selected || albums.length >= 12} aria-label={selected ? `${album.title} añadido` : `Añadir ${album.title}`} onClick={() => setAlbums(current => current.some(item => item.id === album.id) || current.length >= 12 ? current : [...current, album])}><Plus /></Button></li>; })}</ul>}</div>
      </section>
    </fieldset>
    <p className="rounded-lg border bg-secondary/10 p-4 text-sm leading-relaxed">Esta colección será pública y cualquiera podrá compartir su enlace. Incluye solo el texto que quieras hacer público. Tus pendientes y notas de escucha son privados.</p>
    {message && <p role="alert" className="text-sm text-primary">{message}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending}>{pending ? "Guardando…" : initial.albums.length ? "Guardar cambios" : "Publicar colección"}</Button><Button asChild variant="outline"><Link href={initial.albums.length ? `/colecciones/${initial.id}` : "/colecciones"}>Cancelar</Link></Button></div>
  </form>;
}

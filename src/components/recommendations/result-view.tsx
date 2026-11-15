"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, Bookmark, Check, Disc3, ExternalLink, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewCarousel } from "./review-carousel";
import type { RecommendationResult } from "@/features/recommendations/result";
import { setSavedAlbumAction } from "@/features/recommendations/actions";
import { discoverySearchParams, moods, type DiscoveryFilters } from "@/features/discovery/filters";
import type { Platform } from "@/lib/music/types";
import { loginHref } from "@/features/auth/redirects";

const platformLabels: Record<Platform, string> = { spotify: "Spotify", appleMusic: "Apple Music", youtubeMusic: "YouTube Music", bandcamp: "Bandcamp", tidal: "Tidal" };

export function ResultView({ result, filters, excluded = [], preview = false }: { result: RecommendationResult; filters: DiscoveryFilters; excluded?: string[]; preview?: boolean }) {
  const { album } = result;
  const [saved, setSaved] = useState(result.saved);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const nextParams = discoverySearchParams(filters);
  const currentParams = discoverySearchParams(filters);
  for (const id of excluded) currentParams.append("skip", id);
  const accessUrl = loginHref(`/descubrir?${currentParams}`);
  const skipped = [...new Set([...excluded, album.id])];
  if (skipped.length <= 200) for (const id of skipped) nextParams.append("skip", id);

  function save() {
    if (busy.current || preview) return;
    if (!result.viewerId) { setMessage("Inicia sesión para guardar este disco en tus pendientes."); return; }
    busy.current = true; setMessage("");
    startTransition(async () => {
      try {
        const response = await setSavedAlbumAction({ albumId: album.id, saved: !saved });
        if (!response.ok) { setMessage(response.message); return; }
        setSaved(response.data.saved);
        setMessage(response.data.saved ? "Disco guardado en pendientes de escuchar." : "Disco retirado de pendientes.");
      } catch { setMessage("No se pudo guardar el cambio. Inténtalo de nuevo."); }
      finally { busy.current = false; }
    });
  }
  return <div className="mt-10 grid items-start gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
    <section aria-label="Ficha del álbum" className="min-w-0">
      <div className="relative mx-auto max-w-[370px] px-6 pb-7"><Link href={`/albumes/${album.id}`} onClick={event => { if (preview) event.preventDefault(); }} className="album-sleeve block" aria-label={`Dónde escuchar ${album.title}`}>{album.coverUrl ? <Image src={album.coverUrl} alt={`Portada de ${album.title}`} width={740} height={740} sizes="(max-width: 640px) 80vw, 330px" className="album-cover" unoptimized /> : <div className="album-cover flex items-center justify-center bg-card"><Disc3 className="size-24 text-primary/60" strokeWidth={1} /></div>}</Link><span className="absolute bottom-2 right-2 rotate-[-5deg] border bg-background px-3 py-1.5 font-mono text-[9px]">LADO A → LADO B</span></div>
      <div className="mt-4"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{album.year ?? "SIN FECHA"} · ÁLBUM COMPLETO</p><h2 className="mt-2 text-[38px] leading-tight tracking-tight"><Link href={`/albumes/${album.id}`} onClick={event => { if (preview) event.preventDefault(); }} className="hover:text-primary">{album.title}</Link></h2><p className="mt-2 text-lg text-muted-foreground">{album.artists.join(", ")}</p><p className="mt-3 text-xs text-muted-foreground">{album.genres.join(" · ")}</p></div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Vibes predominantes">{album.vibes.map(vibe => <span key={vibe} className="vibe-chip text-[10px]">{moods.find(item => item.value === vibe)?.label}</span>)}</div>
      <div className="mt-6 border-t pt-5"><p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider"><Headphones className="size-3.5 text-secondary" />Escúchalo a tu manera</p><div className="flex flex-wrap gap-2">{(Object.entries(album.links) as Array<[Platform, string]>).map(([platform, url]) => <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-disabled={preview} onClick={event => { if (preview) event.preventDefault(); }} className="inline-flex items-center gap-2 rounded-md border bg-card/40 px-3 py-2 text-[11px] transition-colors hover:border-primary hover:bg-primary/5">{platformLabels[platform]}<ExternalLink className="size-3" /><span className="sr-only">(nueva pestaña)</span></a>)}</div><Link href={`/albumes/${album.id}`} onClick={event => { if (preview) event.preventDefault(); }} className="mt-3 inline-flex items-center gap-2 text-xs text-primary">Ver todas las plataformas <ExternalLink className="size-3" /></Link></div>
    </section>
    <div className="min-w-0"><ReviewCarousel albumId={album.id} initialPage={result.reviews} viewerId={result.viewerId} preview={preview} loginUrl={accessUrl} />
      <div className="mt-8 border-t pt-6"><p className="mb-4 font-serif text-lg italic text-muted-foreground">¿Este no es tu disco de hoy?</p><Button asChild className="h-12 w-full"><Link href={`/descubrir?${nextParams}`} aria-disabled={preview} onClick={event => { if (preview) event.preventDefault(); }}>{skipped.length > 200 ? "Reiniciar la búsqueda" : "Dame otra recomendación"}<ArrowRight /></Link></Button><Button className="mt-3 w-full" variant="outline" disabled={pending || preview} onClick={save} aria-pressed={saved}>{saved ? <Check /> : <Bookmark />}{saved ? "Guardado en pendientes" : "Guardar en pendientes"}</Button><p role="status" className="mt-3 min-h-5 text-center text-xs text-secondary">{message}</p><p className="text-center font-mono text-[9px] text-muted-foreground">TUS FILTROS SE QUEDAN. EL DISCO CAMBIA.</p></div>
    </div>
  </div>;
}

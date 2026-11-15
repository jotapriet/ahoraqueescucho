"use client";

import { AlbumArtwork } from "@/components/album-artwork";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, CheckCircle2, Disc3, HeartHandshake, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailAccess } from "@/components/auth/email-access";
import { getAlbumAction, searchAlbumsAction } from "@/features/music/actions";
import { publishRecommendationAction } from "@/features/contributions/actions";
import { contributionSchema, type PublishResult } from "@/features/contributions/schema";
import { contexts, discoverySearchParams, languages, moods } from "@/features/discovery/filters";
import type { MusicAlbum, MusicProvider } from "@/lib/music/types";

export function ContributionForm({ provider: defaultProvider, signedIn, authAvailable, publishingAvailable }: { provider: MusicProvider; signedIn: boolean; authAvailable: boolean; publishingAvailable: boolean }) {
  const [provider, setProvider] = useState<MusicProvider>(defaultProvider);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicAlbum[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [searchMessage, setSearchMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [album, setAlbum] = useState<MusicAlbum | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedContexts, setContexts] = useState<string[]>(["active_listening"]);
  const [selectedMoods, setMoods] = useState<string[]>([]);
  const [energy, setEnergy] = useState(2);
  const [language, setLanguage] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<Extract<PublishResult, { ok: true }>["data"] | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const searchVersion = useRef(0);
  const selectionVersion = useRef(0);

  useEffect(() => {
    const version = ++searchVersion.current;
    const value = query.trim();
    if (album || value.length < 2) { setResults([]); setSearchState("idle"); return; }
    setSearchState("loading"); setSearchMessage(""); setResults([]);
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchAlbumsAction({ query: value, provider, limit: 8 });
        if (version !== searchVersion.current) return;
        if (!response.ok) { setSearchState("error"); setSearchMessage(response.error.message); return; }
        setResults(response.data); setSearchState("ready");
      } catch {
        if (version === searchVersion.current) { setSearchState("error"); setSearchMessage("No se pudo consultar el catálogo. Vuelve a intentarlo."); }
      }
    }, provider === "musicbrainz" ? 700 : 350);
    return () => { window.clearTimeout(timer); searchVersion.current++; };
  }, [query, provider, album, retry]);

  async function choose(result: MusicAlbum) {
    const version = ++selectionVersion.current;
    searchVersion.current++;
    setSelecting(true); setMessage(""); setSearchMessage("");
    try {
      const detail = await getAlbumAction({ provider: result.provider, id: result.id });
      if (version !== selectionVersion.current) return;
      if (!detail.ok) { setSearchMessage(detail.error.message); return; }
      setAlbum(detail.data); setResults([]); setSearchState("idle");
    } catch { if (version === selectionVersion.current) setSearchMessage("No se pudo cargar el disco. Vuelve a seleccionarlo."); }
    finally { if (version === selectionVersion.current) setSelecting(false); }
  }

  function toggle(value: string, current: string[], setter: (values: string[]) => void) {
    setter(current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  }

  function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setMessage("");
    const input = { album: album ? { provider: album.provider, id: album.id } : null, contexts: selectedContexts, energy, moods: selectedMoods, language, comment };
    const parsed = contributionSchema.safeParse(input);
    if (!parsed.success) { setMessage("Selecciona un álbum, al menos un contexto y un mood, el idioma y un comentario de hasta 280 caracteres."); return; }
    if (!signedIn || !publishingAvailable) { setMessage("Necesitas una sesión iniciada y que la colección esté disponible para publicar."); return; }
    busy.current = true;
    startTransition(async () => {
      try {
        const response = await publishRecommendationAction(parsed.data);
        if (!response.ok) { setMessage(response.message); return; }
        setSuccess(response.data);
      } catch { setMessage("No se pudo publicar. Tu recomendación sigue aquí para volver a intentarlo."); }
      finally { busy.current = false; }
    });
  }

  if (success && album) {
    const discovery = discoverySearchParams({ context: selectedContexts[0] as (typeof contexts)[number]["value"], energy, moods: selectedMoods as (typeof moods)[number]["value"][], language: language as "instrumental" | "es" | "en" | "other" });
    return <section className="mx-auto max-w-2xl rounded-xl border bg-card/40 p-7 text-center sm:p-12" aria-live="polite"><CheckCircle2 className="mx-auto mb-6 size-12 text-secondary" strokeWidth={1.5} /><p className="eyebrow mb-3">OTRA BUENA ESCUCHA EN LA COLECCIÓN</p><h2 className="text-3xl">{success.created ? "Tu disco ya tiene su sitio." : "Este disco ya llevaba tu firma."}</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{success.created ? `Gracias por recomendar ${album.title}. Quizá sea justo lo que alguien necesitaba escuchar hoy.` : "Ya habías recomendado este álbum. Hemos conservado tu reseña original, sin duplicarla ni cambiarla."}</p>{success.linksPending && <p className="mt-4 text-xs text-muted-foreground">Algunos enlaces de escucha todavía no están disponibles.</p>}<Link className="mt-5 inline-flex text-xs font-semibold text-primary underline underline-offset-4" href={`/albumes/${success.albumId}`}>Elegir dónde escucharlo</Link><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href={`/descubrir?${discovery}`}>Seguir descubriendo <ArrowRight /></Link></Button><Button variant="outline" onClick={() => { setSuccess(null); setAlbum(null); setQuery(""); setComment(""); setMessage(""); }}>Recomendar otro disco</Button></div></section>;
  }

  return <>
    {!signedIn && authAvailable && <EmailAccess />}
    {!publishingAvailable && <p className="mb-7 rounded-md border bg-card/50 p-4 text-xs leading-relaxed text-muted-foreground">La colección aún no admite nuevas aportaciones. Puedes explorar los discos y preparar tu recomendación, pero la publicación no está disponible por ahora.</p>}
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_330px] lg:gap-12">
      <form onSubmit={publish} className="min-w-0 rounded-xl border bg-background" aria-label="Añadir una recomendación">
        <fieldset disabled={pending} className="selector-section border-b"><legend className="sr-only">Elige un álbum</legend><div className="section-label"><span className="step-number">01</span><h2 className="font-sans text-sm font-semibold">Ese disco que alguien debería escuchar.</h2></div>
          <div className="mb-4"><label htmlFor="catalog-provider" className="mb-2 block text-xs font-semibold">Buscar en</label><select id="catalog-provider" value={provider} disabled={selecting || pending} onChange={event => { selectionVersion.current++; searchVersion.current++; setProvider(event.target.value as MusicProvider); setAlbum(null); setResults([]); setSearchMessage(""); }} className="h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="musicbrainz">MusicBrainz · catálogo abierto</option><option value="deezer">Deezer</option>{defaultProvider === "spotify" && <option value="spotify">Spotify</option>}</select></div>{album ? <div className="flex items-center gap-4 rounded-md border border-secondary/30 bg-secondary/5 p-3"><Check className="size-5 shrink-0 text-secondary" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{album.title}</p><p className="mt-1 text-xs text-muted-foreground">{album.artists.join(", ")}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Cambiar álbum" onClick={() => { selectionVersion.current++; setAlbum(null); setSelecting(false); setQuery(""); setSearchMessage(""); }}><X /></Button></div>
          : <><label htmlFor="album-search" className="sr-only">Buscar álbum o artista</label><div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><input id="album-search" type="search" value={query} onChange={event => { selectionVersion.current++; setSelecting(false); setQuery(event.target.value); }} maxLength={120} autoComplete="off" placeholder="Busca un álbum o un artista…" aria-describedby="catalog-help album-search-status" className="h-12 w-full rounded-md border bg-card/25 pl-10 pr-3 text-sm" /></div><p id="catalog-help" className="mt-2 font-mono text-[9px] text-muted-foreground">CATÁLOGO DE {provider.toUpperCase()} · ÁLBUMES COMPLETOS</p><div id="album-search-status" role="status" className="mt-2 text-xs text-muted-foreground">{selecting ? "Cargando el álbum…" : searchState === "loading" ? "Buscando en la cubeta…" : searchMessage || (searchState === "ready" && !results.length ? "No encontramos discos con esa búsqueda. Prueba el título o el artista." : "")}</div>{searchState === "error" && <button type="button" className="mt-2 text-xs text-primary underline" onClick={() => setRetry(current => current + 1)}>Reintentar búsqueda</button>}{results.length > 0 && <ul className="mt-3 max-h-80 overflow-y-auto rounded-md border" aria-label="Álbumes encontrados">{results.map(result => <li key={`${result.provider}:${result.id}`} className="border-b last:border-b-0"><button type="button" onClick={() => choose(result)} disabled={selecting} className="flex w-full items-center gap-3 p-3 text-left hover:bg-card disabled:opacity-50"><AlbumArtwork url={result.coverUrl} title={result.title} className="size-12 shrink-0 rounded-sm object-cover" /><span className="min-w-0 flex-1"><span className="block break-words text-xs font-semibold">{result.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{result.artists.join(", ")}{result.releaseYear ? ` · ${result.releaseYear}` : ""}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button></li>)}</ul>}</>}
        </fieldset>

        <fieldset disabled={pending} className="selector-section border-b"><legend className="sr-only">Etiquetas de la recomendación</legend><div className="section-label"><span className="step-number">02</span><h2 className="font-sans text-sm font-semibold">¿Para qué momento lo guardarías?</h2></div><p className="mb-3 text-xs font-semibold">Contexto <span className="font-normal text-muted-foreground">· uno o varios</span></p><div className="flex flex-wrap gap-2">{contexts.map(item => <button key={item.value} type="button" aria-pressed={selectedContexts.includes(item.value)} onClick={() => toggle(item.value, selectedContexts, setContexts)} className="vibe-chip gap-1.5 text-[11px]">{item.detail}{selectedContexts.includes(item.value) && <Check className="size-3 text-primary" />}</button>)}</div>
          <div className="my-7"><label htmlFor="contribution-energy" className="flex justify-between text-xs font-semibold">Energía del disco <output className="font-mono text-primary">{energy} / 5</output></label><input id="contribution-energy" type="range" min="1" max="5" step="1" value={energy} onChange={event => setEnergy(Number(event.target.value))} className="energy-slider mt-5" style={{ "--range-progress": `${(energy - 1) * 25}%` } as React.CSSProperties} /><div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground"><span>AMBIENT / SUSURROS</span><span>ADRENALINA / CAOS</span></div></div>
          <p className="mb-3 text-xs font-semibold">Lo que te hace sentir <span className="font-normal text-muted-foreground">· al menos un mood</span></p><div className="flex flex-wrap gap-2">{moods.map(item => <button key={item.value} type="button" aria-pressed={selectedMoods.includes(item.value)} onClick={() => toggle(item.value, selectedMoods, setMoods)} className="vibe-chip gap-1.5 text-[11px]">{item.label}{selectedMoods.includes(item.value) && <Check className="size-3 text-primary" />}</button>)}</div><label htmlFor="contribution-language" className="mb-2 mt-6 block text-xs font-semibold">Idioma del álbum</label><select id="contribution-language" value={language} onChange={event => setLanguage(event.target.value)} required className="w-full rounded-md border bg-background p-3 text-xs"><option value="" disabled>Elige el idioma</option>{languages.filter(item => item.value !== "any").map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </fieldset>

        <fieldset disabled={pending} className="selector-section"><legend className="sr-only">Tu comentario</legend><div className="section-label"><span className="step-number">03</span><h2 className="font-sans text-sm font-semibold">Cuéntanos por qué merece la pena.</h2></div><label htmlFor="recommendation-comment" className="sr-only">Tu recomendación</label><textarea id="recommendation-comment" value={comment} onChange={event => { if ([...event.target.value].length <= 280) setComment(event.target.value); }} required rows={5} placeholder="Como si se lo recomendaras a alguien al otro lado del mostrador…" aria-describedby="comment-count" className="w-full resize-y rounded-md border bg-card/25 p-4 text-sm leading-relaxed" /><div id="comment-count" className="mt-2 flex justify-between gap-3 text-[10px] text-muted-foreground"><span>Tu experiencia, sin spoilers. Máximo 280 caracteres.</span><span className="shrink-0 font-mono">{[...comment].length}/280</span></div></fieldset>
        <div className="rounded-b-xl border-t bg-card/50 p-5 sm:px-7"><Button type="submit" className="h-12 w-full" disabled={pending || !signedIn || !publishingAvailable || !album}>{pending ? <><Loader2 className="animate-spin" />Publicando tu recomendación…</> : <>Aportar a la colección <ArrowRight /></>}</Button>{!signedIn && <p className="mt-3 text-center text-[10px] text-muted-foreground">Inicia sesión para firmar y publicar tu recomendación.</p>}<p role="status" className="mt-3 text-xs leading-relaxed text-primary">{message}</p></div>
      </form>

      <aside className="order-first min-w-0 lg:sticky lg:top-8 lg:order-last" aria-label="Tu disco seleccionado">{album ? <div className="rounded-xl border bg-card/35 p-6"><p className="eyebrow mb-6">TU APORTACIÓN EMPIEZA AQUÍ</p><div className="album-sleeve mx-auto max-w-[235px]"><AlbumArtwork url={album.coverUrl} title={album.title} /></div><p className="mt-6 font-mono text-[10px] text-muted-foreground">{album.releaseYear ?? "ÁLBUM COMPLETO"}</p><h2 className="mt-2 break-words text-2xl leading-tight">{album.title}</h2><p className="mt-2 text-xs text-muted-foreground">{album.artists.join(", ")}</p>{album.genres.length > 0 && <p className="mt-3 text-[10px] text-muted-foreground">{album.genres.join(" · ")}</p>}<p className="mt-6 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">Si ya está en la colección, tu experiencia se sumará a la de otros curadores. Cada persona puede recomendarlo una sola vez.</p></div> : <div className="rounded-xl border bg-card/30 p-7"><Disc3 className="mb-7 size-16 text-primary/70" strokeWidth={1} /><h2 className="text-3xl leading-tight">Hay discos que no deberían quedarse solo contigo.</h2><p className="mt-5 text-xs leading-[1.9] text-muted-foreground">Elige uno que te haya acompañado. Ponle un momento, una emoción y unas palabras tuyas.</p><div className="mt-7 flex gap-2 border-t pt-5 text-[11px] text-secondary"><HeartHandshake className="size-4 shrink-0" /><span>Una recomendación humana vale más que mil reproducciones.</span></div></div>}</aside>
    </div>
  </>;
}

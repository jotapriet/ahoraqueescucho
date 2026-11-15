import Link from "next/link";
import { ArrowLeft, ArrowRight, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultView } from "@/components/recommendations/result-view";
import { contexts, discoverySearchParams, moods, parseDiscoveryFilters, type SearchParams } from "@/features/discovery/filters";
import { getRecommendationResult, parseExcluded } from "@/features/recommendations/result";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = parseDiscoveryFilters(params);
  const excluded = parseExcluded(params.skip);
  const editHref = `/?${discoverySearchParams(filters)}#tu-momento`;
  const state = await getRecommendationResult(filters, excluded);
  return <main id="main-content" className="site-container pb-16 pt-8 sm:pt-10">
    <Link href={editHref} className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a mi momento</Link>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-3">UNA ESCUCHA PARA HOY</p><h1 className="text-[36px] tracking-tight sm:text-[44px]">Dale una vuelta a este disco.</h1></div><div className="flex flex-wrap gap-2 text-xs"><span className="vibe-chip text-[10px]">{contexts.find(item => item.value === filters.context)?.detail}</span><span className="vibe-chip text-[10px]">Energía {filters.energy}/5</span>{moods.filter(item => filters.moods.includes(item.value)).map(mood => <span className="vibe-chip text-[10px]" key={mood.value}>{mood.label}</span>)}</div></div>
    {state.status === "ready" ? <ResultView key={`${state.result.album.id}:${state.result.viewerId ?? "anon"}`} result={state.result} filters={filters} excluded={excluded} />
      : <section className="mt-10 rounded-xl border bg-card/40 px-6 py-16 text-center" aria-live="polite"><Headphones className="mx-auto mb-6 size-10 text-primary" strokeWidth={1} /><h2 className="text-3xl">{state.status === "empty" ? excluded.length ? "Has llegado al final de esta cubeta." : "Este momento busca su primer disco." : "La colección aún no está disponible."}</h2><p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{state.status === "empty" ? "No quedan álbumes compatibles con esta combinación. Puedes ajustar tu momento o volver a recorrer la selección." : "No hemos podido consultar las recomendaciones. Tus filtros siguen aquí para volver a intentarlo."}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button asChild variant="outline"><Link href={editHref}>Ajustar mi momento <ArrowRight /></Link></Button>{excluded.length > 0 && <Button asChild><Link href={`/descubrir?${discoverySearchParams(filters)}`}>Volver a recorrer la selección</Link></Button>}</div></section>}
  </main>;
}

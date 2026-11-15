import { notFound } from "next/navigation";
import { ResultView } from "@/components/recommendations/result-view";
import { parseDiscoveryFilters } from "@/features/discovery/filters";
import { resultFixture } from "../../../../tests/fixtures/recommendation";

export default function ResultPreview() {
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_UI_PREVIEWS !== "true") notFound();
  return <main id="main-content" className="site-container py-10"><p className="mb-7 rounded border border-primary/30 bg-primary/5 p-3 text-xs">Vista de desarrollo · reseñas y votos ficticios · acciones desactivadas</p><p className="eyebrow mb-3">UNA ESCUCHA PARA HOY</p><h1 className="text-[36px] tracking-tight sm:text-[44px]">Dale una vuelta a este disco.</h1><ResultView result={resultFixture} filters={parseDiscoveryFilters({})} preview /></main>;
}

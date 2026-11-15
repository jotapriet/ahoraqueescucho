"use client";

import { useState } from "react";
import { Armchair, ArrowRight, Car, Check, ChevronDown, Cloud, Coffee, Globe2, Headphones, History, Moon, Orbit, Radio, Sparkles, Sun, Volume1, Volume2, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contexts, languages, moods, type DiscoveryFilters } from "@/features/discovery/filters";

const contextIcons = { headphones: Headphones, coffee: Coffee, car: Car, wine: Wine, armchair: Armchair };
const moodIcons = { cloud: Cloud, sparkles: Sparkles, orbit: Orbit, moon: Moon, sun: Sun, history: History };
const energyLabels = ["Ambient / susurros", "Suave, a mi ritmo", "Un poco de movimiento", "Que suba el volumen", "Pura adrenalina / caos"];

export function VibeSelector({ initialFilters }: { initialFilters: DiscoveryFilters }) {
  const [filters, setFilters] = useState(initialFilters);
  function toggleMood(value: DiscoveryFilters["moods"][number]) {
    setFilters(current => ({ ...current, moods: current.moods.includes(value) ? current.moods.filter(m => m !== value) : [...current.moods, value] }));
  }
  return <section id="tu-momento" className="scroll-mt-8" aria-labelledby="selector-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow mb-2">BUSCA POR LO QUE SIENTES</p><h2 id="selector-title" className="text-[30px] leading-tight sm:text-[34px]">Cada momento tiene su disco.</h2></div>
      <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-secondary" />Un minuto para ti. Un álbum entero por descubrir.</p>
    </div>
    <form action="/descubrir" method="get" className="selector-panel overflow-hidden rounded-xl border border-border">
      <fieldset className="selector-section">
        <legend className="sr-only">¿Dónde te encuentra la música?</legend>
        <div className="section-label"><span className="step-number">01</span><h3>¿Dónde te encuentra la música?</h3><span className="section-hint">Elige tu contexto</span></div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {contexts.map(item => {
            const Icon = contextIcons[item.icon];
            return <label key={item.value} className="cursor-pointer last:col-span-2 lg:last:col-span-1">
              <input type="radio" name="context" value={item.value} checked={filters.context === item.value} onChange={() => setFilters({ ...filters, context: item.value })} className="peer sr-only" />
              <span className="context-option flex h-full min-h-[110px] flex-col items-center justify-center gap-1.5 rounded-md border px-2.5 py-4 text-center peer-focus-visible:ring-2 peer-focus-visible:ring-ring" data-selected={filters.context === item.value}>
                <Icon className="mb-1 size-[23px]" strokeWidth={1.5} />
                <span className="text-xs font-semibold">{item.label}</span>
                <span className="text-[10px] text-muted-foreground">{item.detail}</span>
              </span>
            </label>;
          })}
        </div>
      </fieldset>

      <div className="grid border-t border-border md:grid-cols-[.9fr_1.1fr]">
        <fieldset className="selector-section md:border-r md:border-border">
          <legend className="sr-only">Tu nivel de energía</legend>
          <div className="section-label"><span className="step-number">02</span><label htmlFor="energy" className="font-semibold">¿A qué ritmo vas hoy?</label><output htmlFor="energy" className="ml-auto font-mono text-xs text-primary">{String(filters.energy).padStart(2, "0")} / 05</output></div>
          <div className="flex items-center gap-4 pt-4"><Volume1 className="size-4 shrink-0 text-muted-foreground" /><input id="energy" name="energy" type="range" min="1" max="5" step="1" value={filters.energy} onChange={event => setFilters({ ...filters, energy: Number(event.target.value) })} aria-valuetext={energyLabels[filters.energy - 1]} className="energy-slider" style={{ "--range-progress": `${(filters.energy - 1) * 25}%` } as React.CSSProperties} /><Volume2 className="size-4 shrink-0 text-primary" /></div>
          <div className="mt-3 flex justify-between font-mono text-[9px] uppercase tracking-wide text-muted-foreground"><span>Con calma</span><span>A todo volumen</span></div>
          <p className="mt-4 text-center text-xs text-secondary" aria-live="polite">{energyLabels[filters.energy - 1]}</p>
        </fieldset>

        <fieldset className="selector-section border-t border-border md:border-t-0">
          <legend className="sr-only">¿Qué llevas por dentro?</legend>
          <div className="section-label"><span className="step-number">03</span><h3>¿Qué llevas por dentro?</h3><span className="section-hint">Puedes mezclar</span></div>
          <div className="flex flex-wrap gap-2">
            {moods.map(item => { const Icon = moodIcons[item.icon]; const selected = filters.moods.includes(item.value);
              return <button key={item.value} type="button" className="vibe-chip gap-2 px-3 py-2 text-[11px] hover:border-primary/60" aria-pressed={selected} onClick={() => toggleMood(item.value)}><Icon className="size-3.5" strokeWidth={1.5} />{item.label}{selected && <Check className="size-3 text-primary" />}</button>;
            })}
          </div>
          {filters.moods.length ? filters.moods.map(mood => <input key={mood} type="hidden" name="mood" value={mood} />) : <input type="hidden" name="mood" value="" />}
        </fieldset>
      </div>

      <div className="flex flex-col gap-5 border-t border-border bg-card/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-2.5"><Globe2 className="size-4 text-muted-foreground" /><div className="relative"><label htmlFor="language" className="sr-only">Idioma del álbum</label><select id="language" name="language" value={filters.language} onChange={event => setFilters({ ...filters, language: event.target.value as DiscoveryFilters["language"] })} className="h-10 cursor-pointer appearance-none rounded-md border border-transparent bg-transparent py-2 pl-1 pr-7 text-xs hover:border-border"><option value="any">Cualquier idioma</option>{languages.filter(item => item.value !== "any").map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-3.5 size-3" /></div><span className="rounded border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">OPCIONAL</span></div>
        <Button type="submit" className="h-12 w-full gap-3 px-7 sm:w-auto">Encuentra mi próximo disco <ArrowRight /></Button>
      </div>
    </form>
    <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground"><Radio className="size-3.5 shrink-0" />Sin canciones sueltas. Sin prisas. De la primera a la última pista.</p>
  </section>;
}

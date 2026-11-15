"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { contexts, moods, languages } from "@/features/discovery/filters";
import { editRecommendationAction, withdrawRecommendationAction } from "@/features/contributions/manage-actions";
import { recommendationChanges, type RecommendationChanges } from "@/features/contributions/manage-schema";

export function RecommendationEditor({ recommendationId, initial }: { recommendationId: string; initial: RecommendationChanges }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  function toggle(field: "contexts" | "moods", value: string) {
    setDraft(current => ({ ...current, [field]: current[field].includes(value as never) ? current[field].filter(item => item !== value) : [...current[field], value] }));
  }
  return <div className="mt-5 border-t pt-4"><Button variant="outline" size="sm" disabled={pending} aria-expanded={open} aria-controls={id} onClick={() => { setDraft(initial); setConfirm(false); setOpen(!open); setMessage(""); }}>{open ? "Cerrar edición" : "Gestionar mi aportación"}</Button>
    {open && <div id={id} className="mt-5"><form aria-label="Editar mi recomendación" onSubmit={event => {
      event.preventDefault(); setMessage("");
      const parsed = recommendationChanges.safeParse(draft);
      if (!parsed.success) { setMessage("Selecciona al menos un contexto y un mood, y escribe un comentario de hasta 280 caracteres."); return; }
      startTransition(async () => { try { const result = await editRecommendationAction({ recommendationId, ...parsed.data }); if (!result.ok) setMessage(result.message); else { setOpen(false); setMessage("Aportación actualizada."); router.refresh(); } } catch { setMessage("No se pudo guardar. Tus cambios siguen aquí para reintentar."); } });
    }}><fieldset disabled={pending} className="space-y-5"><div><p className="mb-2 text-xs font-semibold">Contexto</p><div className="flex flex-wrap gap-2">{contexts.map(item => <button type="button" key={item.value} aria-pressed={draft.contexts.includes(item.value)} onClick={() => toggle("contexts", item.value)} className="vibe-chip text-[11px]">{item.detail}</button>)}</div></div><div><p className="mb-2 text-xs font-semibold">Estado de ánimo</p><div className="flex flex-wrap gap-2">{moods.map(item => <button type="button" key={item.value} aria-pressed={draft.moods.includes(item.value)} onClick={() => toggle("moods", item.value)} className="vibe-chip text-[11px]">{item.label}</button>)}</div></div>
      <label className="block text-xs font-semibold">Energía: {draft.energy}/5<input type="range" min={1} max={5} step={1} value={draft.energy} onChange={event => setDraft({ ...draft, energy: Number(event.target.value) })} className="mt-3 block w-full accent-primary" /></label>
      <label className="block text-xs font-semibold">Idioma<select value={draft.language} onChange={event => setDraft({ ...draft, language: event.target.value as RecommendationChanges["language"] })} className="mt-2 block w-full rounded-md border bg-background p-3">{languages.filter(item => item.value !== "any").map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="block text-xs font-semibold">Comentario<textarea required rows={5} value={draft.comment} onChange={event => { if ([...event.target.value].length <= 280) setDraft({ ...draft, comment: event.target.value }); }} className="mt-2 block w-full rounded-md border bg-background p-3 text-sm font-normal leading-relaxed" /><span className="mt-2 block text-right font-mono text-[10px] text-muted-foreground">{[...draft.comment].length}/280</span></label>
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button></fieldset></form>
      <div className="mt-6 border-t pt-4">{!confirm ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setConfirm(true); setMessage(""); }}>Retirar mi aportación</Button> : <><p className="text-xs leading-relaxed text-muted-foreground">Se eliminarán tu reseña y sus Acertados. La ficha del álbum y las aportaciones de otras personas se conservarán. Puedes recomendarlo de nuevo, pero no recuperar esta reseña.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={pending} onClick={() => startTransition(async () => { try { const result = await withdrawRecommendationAction({ recommendationId }); if (!result.ok) setMessage(result.message); else { setOpen(false); router.refresh(); } } catch { setMessage("No se pudo retirar la aportación. Inténtalo de nuevo."); } })}>{pending ? "Retirando…" : "Sí, retirar aportación"}</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirm(false)}>Cancelar retirada</Button></div></>}</div>
    </div>}{message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}
  </div>;
}

"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markListenedAction, updateListeningAction } from "@/features/listening-history/actions";
import { listeningInput, todayInMadrid } from "@/features/listening-history/schema";

export function ListeningEditor({ albumId, title, initial }: { albumId: string; title: string; initial?: { listenedOn: string; note: string | null } }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initial?.listenedOn ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const input = { albumId, listenedOn: date, note };
    if (!listeningInput.safeParse(input).success) { setMessage("Revisa la fecha y la longitud de la nota."); return; }
    busy.current = true; setMessage("");
    startTransition(async () => {
      try {
        const result = await (initial ? updateListeningAction(input) : markListenedAction(input));
        if (!result.ok) { setMessage(result.message); return; }
        setOpen(false); router.refresh();
      } catch { setMessage("No se pudo guardar la escucha. Puedes volver a intentarlo."); }
      finally { busy.current = false; }
    });
  }
  return <div className="mt-2"><Button type="button" variant={initial ? "ghost" : "default"} className="w-full text-xs" aria-expanded={open} aria-controls={`${id}-form`} aria-label={`${initial ? "Editar escucha de" : "Ya he escuchado"} ${title}`} disabled={pending} onClick={() => { if (!date) setDate(todayInMadrid()); setOpen(value => !value); setMessage(""); }}>{initial ? <Pencil /> : <Check />}{initial ? "Editar fecha y nota" : "Ya lo he escuchado"}</Button>
    {open && <form id={`${id}-form`} onSubmit={submit} className="mt-4 space-y-3 border-t pt-4"><label htmlFor={`${id}-date`} className="block text-xs font-semibold">Fecha de escucha</label><input id={`${id}-date`} type="date" value={date} onChange={event => setDate(event.target.value)} min="1900-01-01" max={todayInMadrid()} required disabled={pending} className="h-11 w-full rounded-md border bg-background px-3 text-sm" /><label htmlFor={`${id}-note`} className="block text-xs font-semibold">Nota personal <span className="font-normal text-muted-foreground">(opcional y privada)</span></label><textarea id={`${id}-note`} value={note} onChange={event => setNote(event.target.value)} rows={4} maxLength={2000} disabled={pending} placeholder="¿Qué te ha dejado este disco?" className="w-full rounded-md border bg-background p-3 text-sm" /><p className="text-right font-mono text-[10px] text-muted-foreground">{[...note].length}/1000</p>{!initial && <p className="text-[11px] leading-relaxed text-muted-foreground">Al guardar, el disco pasará de pendientes a tu historial privado.</p>}<div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={pending || [...note].length > 1000}>{pending ? "Guardando…" : "Guardar escucha"}</Button><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button></div></form>}
    <p role="status" className="mt-2 text-xs text-primary">{message}</p>
  </div>;
}

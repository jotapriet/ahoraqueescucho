"use client";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSurpriseAlbumAction } from "@/features/discovery/surprise";

export function SurprisePicker({ signedIn, initialExcludeListened = true, again = false }: { signedIn: boolean; initialExcludeListened?: boolean; again?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [excludeListened, setExcludeListened] = useState(initialExcludeListened);
  const [message, setMessage] = useState("");
  const [empty, setEmpty] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  function surprise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setMessage(""); setEmpty(false);
    startTransition(async () => {
      try {
        const exclude = signedIn && excludeListened;
        const result = await getSurpriseAlbumAction({ excludeListened: exclude });
        if (!result.ok) { setMessage(result.message); setEmpty(result.code === "EMPTY"); return; }
        router.push(`/albumes/${result.albumId}?sorpresa=1&sinEscuchados=${exclude ? "1" : "0"}`);
      } catch { setMessage("No se pudo buscar la sorpresa. Vuelve a intentarlo."); }
      finally { busy.current = false; }
    });
  }
  return <section aria-labelledby={`${id}-title`} className="my-9 rounded-xl border border-secondary/30 bg-secondary/5 p-5 sm:p-7"><form onSubmit={surprise} className="flex flex-wrap items-center justify-between gap-5"><div><p className="eyebrow mb-2">UN GIRO INESPERADO</p><h2 id={`${id}-title`} className="text-2xl">{again ? "¿Le damos otra vuelta?" : "Hoy, déjate sorprender."}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Un disco al azar de toda la colección, sin filtros de Vibes.</p>{signedIn && <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={excludeListened} onChange={event => { setExcludeListened(event.target.checked); setMessage(""); setEmpty(false); }} disabled={pending} className="size-4 accent-primary" />Excluir los que ya he escuchado</label>}</div><Button type="submit" disabled={pending} className="h-12 w-full sm:w-auto"><Shuffle />{pending ? "Buscando tu disco…" : again ? "Otra sorpresa" : "Sorpréndeme"}</Button></form><p role="status" className="mt-3 text-xs leading-relaxed text-secondary">{message}</p>{empty && <Link href="/aportar" className="mt-2 inline-block text-xs text-primary underline">Aportar un disco a la colección</Link>}</section>;
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteCollectionAction } from "@/features/collections/actions";

export function ShareCollection({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  return <div><Button variant="outline" onClick={async () => {
    const link = `${window.location.origin}/colecciones/${id}`;
    try { await navigator.clipboard.writeText(link); setMessage("Enlace copiado."); setUrl(""); }
    catch { setMessage("Copia este enlace para compartir la colección:"); setUrl(link); }
  }}>Copiar enlace</Button><p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>{url && <input aria-label="Enlace de la colección" readOnly value={url} onFocus={event => event.target.select()} className="mt-2 w-full rounded border bg-background p-2 text-xs" />}</div>;
}
export function DeleteCollection({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="mt-6 border-t pt-5">{!confirm ? <Button variant="ghost" onClick={() => setConfirm(true)}>Eliminar mi colección</Button> : <><p className="mb-3 text-sm">¿Eliminar esta selección? Los discos y sus recomendaciones se conservan.</p><div className="flex gap-3"><Button disabled={pending} onClick={() => startTransition(async () => { try { const result = await deleteCollectionAction({ id }); if (!result.ok) setMessage(result.message); else { router.push("/colecciones"); router.refresh(); } } catch { setMessage("No se pudo eliminar. Inténtalo de nuevo."); } })}>{pending ? "Eliminando…" : "Sí, eliminar colección"}</Button><Button disabled={pending} variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button></div></>}{message && <p role="alert" className="mt-3 text-sm text-primary">{message}</p>}</div>;
}

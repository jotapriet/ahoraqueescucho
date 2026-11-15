"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendationPath } from "@/features/recommendations/share";

export function ShareRecommendation({ albumId, reviewId }: { albumId: string; reviewId: string }) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  return <div className="mt-5 border-t pt-4"><Button variant="ghost" size="sm" onClick={async () => {
    const url = `${window.location.origin}${recommendationPath(albumId, reviewId)}`;
    try { await navigator.clipboard.writeText(url); setMessage("Enlace de esta reseña copiado."); setFallback(""); }
    catch { setMessage("Copia este enlace para compartir la reseña:"); setFallback(url); }
  }}><Share2 />Compartir esta reseña</Button><p aria-live="polite" className="mt-2 text-xs text-muted-foreground">{message}</p>{fallback && <input aria-label="Enlace de la reseña" readOnly value={fallback} onFocus={event => event.target.select()} className="mt-2 w-full rounded border bg-background p-2 text-xs" />}</div>;
}

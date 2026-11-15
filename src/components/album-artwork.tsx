"use client";
import { useEffect, useState } from "react";
import { Disc3 } from "lucide-react";

export function AlbumArtwork({ url, title, className = "album-cover" }: { url: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <img src={url} alt={`Portada de ${title}`} loading="lazy" className={className} onError={() => setFailed(true)} /> : <div className={`${className} flex aspect-square items-center justify-center bg-card`} aria-label={`Portada no disponible de ${title}`}><Disc3 className="size-12 text-muted-foreground" strokeWidth={1} /></div>;
}

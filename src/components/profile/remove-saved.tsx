"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSavedAlbumAction } from "@/features/recommendations/actions";

export function RemoveSaved({ albumId, title }: { albumId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function remove() {
    setError("");
    startTransition(async () => {
      try {
        const result = await setSavedAlbumAction({ albumId, saved: false });
        if (!result.ok) { setError(result.message); return; }
        router.refresh();
      } catch { setError("No se pudo quitar el disco. Inténtalo de nuevo."); }
    });
  }
  return <div><Button variant="ghost" className="w-full text-xs" onClick={remove} disabled={pending} aria-label={`Quitar ${title} de pendientes`}><BookmarkMinus className="size-4" />{pending ? "Quitando…" : "Quitar de pendientes"}</Button><p role="status" className="text-xs text-primary">{error}</p></div>;
}

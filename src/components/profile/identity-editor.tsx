"use client";
import { useActionState, useId, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimNickAction, updateAvatarAction } from "@/features/profile/actions";

export function IdentityEditor({ nick }: { nick: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [identity, claim, claiming] = useActionState(claimNickAction, { ok: false, message: "" });
  const [photo, upload, uploading] = useActionState(updateAvatarAction, { ok: false, message: "" });
  return <section aria-label="Tu identidad en la colección" className="my-8">
    <Button type="button" variant="outline" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><Pencil />{open ? "Cerrar edición" : nick ? "Editar perfil" : "Elegir nick y editar perfil"}{open ? <ChevronUp /> : <ChevronDown />}</Button>
    <div id={panelId} hidden={!open} className={`${open ? "grid" : "hidden"} mt-4 gap-7 rounded-xl border bg-card/40 p-6 sm:grid-cols-2`}>
    <div><h2 className="text-xl">Tu firma en la colección</h2>{nick ? <><p className="mt-3 font-mono text-sm text-primary">@{nick}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Tu nick es permanente. Aparece junto a tus recomendaciones.</p></> : <form action={claim} className="mt-3 space-y-3"><label htmlFor="profile-nick" className="block text-xs">Elige tu nick. No podrás cambiarlo después.</label><div className="flex items-center gap-2"><span aria-hidden="true">@</span><input id="profile-nick" name="nick" required pattern="[a-z0-9_]{3,24}" minLength={3} maxLength={24} autoCapitalize="none" autoComplete="username" placeholder="tu_nick" className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" disabled={claiming} /></div><p className="text-[11px] text-muted-foreground">De 3 a 24 letras minúsculas, números o guiones bajos. Elige tu nick antes de publicar.</p><Button type="submit" disabled={claiming}>{claiming ? "Guardando…" : "Guardar mi nick definitivo"}</Button><p role="status" className="text-xs text-secondary">{identity.message}</p></form>}</div>
    <form action={upload} className="space-y-3"><h2 className="text-xl">Tu foto</h2><label htmlFor="profile-avatar" className="block text-xs text-muted-foreground">Foto pública · JPG, PNG o WebP · hasta 768 KB</label><input id="profile-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="block w-full text-xs file:mr-3 file:rounded file:border file:bg-background file:px-3 file:py-2 file:text-foreground" /><div className="flex flex-wrap gap-2"><Button type="submit" disabled={uploading}>{uploading ? "Guardando…" : "Actualizar foto"}</Button><Button type="submit" name="remove" value="true" variant="ghost" disabled={uploading}>Quitar foto</Button></div><p role="status" className="text-xs text-secondary">{photo.message}</p></form>
    </div>
  </section>;
}

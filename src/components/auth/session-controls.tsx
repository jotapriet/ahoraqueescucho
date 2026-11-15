"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { loginHref } from "@/features/auth/redirects";
import type { Viewer } from "@/features/auth/session";

export function SessionControls({ viewer }: { viewer: Viewer | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const busy = useRef(false);
  function logout() {
    if (busy.current) return;
    busy.current = true; setError("");
    startTransition(async () => {
      try {
        const result = await signOutAction();
        if (!result.ok) { setError(result.message); return; }
        router.replace("/"); router.refresh();
      } catch { setError("No se pudo cerrar la sesión."); }
      finally { busy.current = false; }
    });
  }
  if (!viewer) return pathname === "/login" ? null : <Link href={loginHref(`${pathname}${params.size ? `?${params}` : ""}`)} className="inline-flex items-center gap-1.5 text-xs font-semibold"><LogIn className="size-4" /><span>Entrar</span></Link>;
  return <div className="relative flex items-center gap-2"><Link href="/perfil" aria-label="Mi perfil y pendientes" title="Mi perfil y pendientes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><UserRound className="size-4 shrink-0" /><span className="hidden sm:inline">Mi perfil</span></Link><button type="button" onClick={logout} disabled={pending} aria-label="Cerrar sesión" title="Cerrar sesión" className="inline-flex items-center gap-1.5 rounded px-1 py-2 text-xs font-semibold disabled:opacity-50"><LogOut className="size-4" /><span className="hidden sm:inline">{pending ? "Saliendo…" : "Salir"}</span></button><span role="status" className="absolute right-0 top-full z-20 w-56 text-right text-[10px] text-primary">{error}</span></div>;
}

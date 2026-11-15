import Link from "next/link";
import { ArrowUpRight, Disc3 } from "lucide-react";
import { Suspense } from "react";
import { ThemeToggle } from "./theme-toggle";
import { SessionControls } from "./auth/session-controls";
import { getAuthState } from "@/features/auth/session";

export async function SiteHeader() {
  const { viewer } = await getAuthState();
  return <header className="border-b border-border/80">
    <div className="site-container flex h-24 items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Ahora qué escucho, inicio">
        <Disc3 className="size-9 text-primary" strokeWidth={1.5} />
        <span className="font-serif text-[22px] font-semibold leading-[.95] tracking-tight">ahora qué<br />escucho<span className="text-primary">.</span></span>
      </Link>
      <nav aria-label="Navegación principal" className="flex items-center gap-3 sm:gap-5 lg:gap-7">
        <Link href="/#tu-momento" className="hidden text-sm font-semibold text-primary sm:block">Descubrir</Link>
        <Link href="/colecciones" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Colecciones</Link>
        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <ThemeToggle />
        <Link href="/aportar" className="flex items-center gap-1.5 text-[11px] font-semibold sm:text-xs"><span className="sm:hidden">Aportar</span><span className="hidden sm:inline">Aportar a la colección</span><ArrowUpRight className="size-4" /></Link>
        <Suspense fallback={<span className="w-12" />}><SessionControls viewer={viewer} /></Suspense>
      </nav>
    </div>
  </header>;
}

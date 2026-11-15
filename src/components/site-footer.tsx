import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";

export function SiteFooter() {
  return <footer className="border-t border-border/70"><div className="site-container flex flex-col items-start justify-between gap-4 py-7 text-[11px] text-muted-foreground sm:flex-row sm:items-center"><p>Hecho para escuchar con un poco más de calma.</p><nav aria-label="Sobre el proyecto" className="flex flex-wrap items-center gap-5"><Link href="/colecciones" className="hover:text-foreground">Colecciones</Link><Link href="/apoyar" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"><Heart className="size-3.5" />Apoya el proyecto</Link><a href="https://jprietom.dev" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">Contacto<ArrowUpRight className="size-3.5" /></a></nav></div></footer>;
}

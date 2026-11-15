import Image from "next/image";
import { getAuthState } from "@/features/auth/session";
import { SurprisePicker } from "@/components/discovery/surprise-picker";
import { getInspirationAlbums } from "@/features/discovery/inspiration";
import Link from "next/link";
import { ArrowDown, Disc3, HeartHandshake, Headphones, MoveUpRight } from "lucide-react";
import { VibeSelector } from "@/components/discovery/vibe-selector";
import { discoverySearchParams, parseDiscoveryFilters, type SearchParams } from "@/features/discovery/filters";

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseDiscoveryFilters(await searchParams);
  const [inspiration, { viewer }] = await Promise.all([getInspirationAlbums(), getAuthState()]);
  return <>
    <main id="main-content" className="site-container">
      <section className="hero-grid grid items-center gap-8 pb-12 pt-12 md:grid-cols-[1.25fr_.75fr] md:pb-14 md:pt-14" aria-labelledby="hero-title">
        <div className="relative z-10">
          <p className="eyebrow mb-5 flex items-center gap-2"><span className="h-px w-5 bg-primary" />CURADURÍA HUMANA. ESCUCHAS COMPLETAS.</p>
          <h1 id="hero-title" className="max-w-[680px] text-[clamp(2.6rem,5.3vw,4.65rem)] leading-[1.04] tracking-[-.045em]">Menos algoritmo.<br />Más <em className="font-normal text-primary">piel de gallina.</em></h1>
          <p className="mt-6 max-w-[455px] text-sm leading-[1.9] text-muted-foreground">Hay discos que llegan justo cuando los necesitas.<br className="hidden sm:block" /> Encuentra tu próxima escucha, recomendada por alguien que también la sintió.</p>
          <Link href="#tu-momento" className="mt-7 inline-flex items-center gap-3 text-xs font-semibold"><span className="flex size-7 items-center justify-center rounded-full border border-border"><ArrowDown className="size-3.5" /></span>¿Qué te apetece escuchar hoy?</Link>
        </div>
        <div className="hero-records relative mx-auto hidden h-[305px] w-[340px] md:block" aria-label="Discos para escuchar sin prisa">
          <span className="absolute -right-2 top-1 font-serif text-sm italic text-muted-foreground">el lado bueno de parar <MoveUpRight className="ml-1 inline-block size-5 rotate-45" strokeWidth={1} /></span>
          <div className="absolute left-0 top-12 h-[224px] w-[224px] -rotate-[12deg] rounded-md bg-[#c0a48e] p-2 shadow-sleeve"><Image src="/images/bon-iver.jpg" alt="" width={224} height={224} className="rounded-sm" /></div>
          <div className="hero-vinyl absolute right-0 top-[61px] size-[213px] rounded-full shadow-sleeve"><div className="vinyl-label"><span>AHORA QUÉ<br />ESCUCHO</span><i /></div></div>
          <div className="absolute left-[65px] top-[67px] w-[224px] rotate-[7deg] overflow-hidden rounded-md shadow-sleeve"><Image src="/images/khruangbin.jpg" alt="Portada de Con Todo El Mundo de Khruangbin" width={448} height={448} sizes="224px" preload /></div>
          <span className="absolute -bottom-2 left-[92px] -rotate-[5deg] border border-border bg-background px-4 py-2 font-mono text-[9px] shadow-sm">DALE TIEMPO A UN DISCO ENTERO.</span>
          <span className="absolute -left-2 top-0 font-serif text-[45px] text-primary/70" aria-hidden="true">✳</span>
        </div>
      </section>

      <SurprisePicker signedIn={!!viewer} />

      <VibeSelector key={discoverySearchParams(filters).toString()} initialFilters={filters} />

      <aside className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-xl border bg-secondary/10 p-6"><div><p className="eyebrow mb-2">SELECCIONES CON UN HILO EN COMÚN</p><h2 className="text-2xl">Discos para una tarde de lluvia. O para la tuya.</h2><p className="mt-2 text-sm text-muted-foreground">Explora pequeñas colecciones temáticas firmadas por curadores.</p></div><Link href="/colecciones" className="text-sm font-semibold text-primary underline underline-offset-4">Explorar colecciones →</Link></aside>

      <section id="coleccion" className="pb-16 pt-16" aria-labelledby="collection-title">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">LA CUBETA DE INSPIRACIÓN</p><h2 id="collection-title" className="text-[29px] tracking-tight">Tres discos. Mil formas de sentirlos.</h2></div><Disc3 className="mb-1 hidden size-7 text-muted-foreground/50 sm:block" strokeWidth={1} /></div>
        {!inspiration.available ? <p className="rounded-lg border bg-card/35 p-6 text-sm text-muted-foreground">No hemos podido abrir la cubeta. Vuelve a intentarlo en un momento.</p> : !inspiration.albums.length ? <p className="rounded-lg border bg-card/35 p-6 text-sm text-muted-foreground">La cubeta espera sus primeros discos. <Link href="/aportar" className="text-primary underline">Aporta tu primera recomendación.</Link></p> : <>
        <div className="grid gap-6 sm:grid-cols-3">
          {inspiration.albums.map(record => {
            const contents = <><div className="album-sleeve aspect-square">{record.cover_url ? <Image src={record.cover_url} alt={`Portada de ${record.title}`} width={320} height={320} unoptimized className="album-cover" /> : <div className="flex h-full items-center justify-center rounded-md bg-card"><Disc3 className="size-12 text-muted-foreground" strokeWidth={1} /></div>}</div><div className="min-w-0 sm:mt-4 lg:mt-0"><span className="mb-2.5 inline-block font-mono text-[9px] text-muted-foreground">{record.release_year ?? "S/F"} · ÁLBUM COMPLETO</span><h3 className="break-words text-xl leading-tight">{record.title}</h3><p className="mt-1.5 text-xs text-muted-foreground">{record.artists.join(", ")}</p><span className="mt-4 inline-block rounded-sm bg-secondary/10 px-2 py-1 text-[9px] text-secondary">De nuestra colección</span></div></>;
            const style = "record-card group grid grid-cols-[minmax(0,112px)_minmax(0,1fr)] items-center gap-5 rounded-lg border border-border bg-card/35 p-4 transition-colors hover:bg-card/75 sm:block sm:p-4 lg:grid lg:grid-cols-[minmax(0,120px)_minmax(0,1fr)]";
            return <Link key={record.id} href={`/albumes/${record.id}`} className={style} aria-label={`Dónde escuchar ${record.title} de ${record.artists.join(", ")}`}>{contents}</Link>;
          })}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Hasta tres discos elegidos al azar de la colección en cada visita. Pulsa una portada para elegir dónde escuchar el álbum.</p>
        </>}
      </section>

      <section id="como-funciona" className="mb-14 grid gap-7 border-y border-border py-8 sm:grid-cols-3" aria-label="Nuestra filosofía">
        {[{ Icon: HeartHandshake, title: "De persona a persona", text: "El mejor consejo musical sigue siendo un «tienes que escuchar esto»." }, { Icon: Disc3, title: "El disco, de principio a fin", text: "La historia completa. Tal y como la imaginó quien la creó." }, { Icon: Headphones, title: "Tu momento, tu escucha", text: "Para cómo te sientes hoy. No para cómo te clasificó un algoritmo." }].map(({ Icon, title, text }) => <div key={title} className="flex gap-3"><Icon className="mt-1 size-5 shrink-0 text-secondary" strokeWidth={1.5} /><div><h3 className="font-sans text-xs font-semibold">{title}</h3><p className="mt-2 max-w-[255px] text-[11px] leading-relaxed text-muted-foreground">{text}</p></div></div>)}
      </section>
    </main>
  </>;
}

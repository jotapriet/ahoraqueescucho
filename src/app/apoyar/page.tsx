import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Code2, Heart, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Apoya el proyecto · Ahora qué escucho",
  description: "Ayuda a mantener un espacio de descubrimiento musical humano, sin anuncios ni rastreo y con código abierto.",
};

export default function SupportPage() {
  return <main id="main-content" className="site-container py-10 sm:py-14">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Volver a la tienda</Link>
    <div className="mx-auto max-w-2xl py-10 sm:py-16">
      <div className="mb-7 inline-flex size-14 items-center justify-center rounded-full border border-primary/25 bg-primary/10"><Heart className="size-6 text-primary" strokeWidth={1.5} /></div>
      <p className="eyebrow mb-4">PARA QUE SIGA GIRANDO</p>
      <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl">La buena música se comparte.<br /><em className="font-normal text-primary">Este espacio también se cuida.</em></h1>
      <div className="mt-7 space-y-5 text-sm leading-7 text-muted-foreground">
        <p>Ahora qué escucho nace de algo sencillo: descubrir un disco porque alguien sintió que merecía la pena compartirlo. Sin anuncios, sin rastreo y sin algoritmos que decidan por ti. Solo personas, álbumes completos y ganas de escuchar.</p>
        <p>Detrás de esta web hay una sola persona: yo me encargo de desarrollarla y mantenerla. Su código es completamente abierto, porque creo que un proyecto así tiene más sentido cuando se puede conocer, compartir y mejorar entre todos.</p>
        <p>Si aquí has encontrado un disco que se ha quedado contigo, puedes ayudarme a que el proyecto siga girando. Tu donación contribuye a mantener la web y a dedicarle tiempo para cuidarla y mejorarla. Cualquier aportación, por pequeña que sea, suma.</p>
      </div>
      <section aria-labelledby="support-title" className="my-9 rounded-xl border bg-card/60 p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3"><HeartHandshake className="size-5 text-secondary" strokeWidth={1.5} /><h2 id="support-title" className="text-2xl">Un pequeño gesto, muchas escuchas.</h2></div>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">Tú eliges el importe. La aportación es voluntaria y se realiza directamente en PayPal.</p>
        <Button asChild className="h-12 w-full sm:w-auto"><a href="https://paypal.me/jotapriet" target="_blank" rel="noopener noreferrer">Apoyar con PayPal<ArrowUpRight /></a></Button>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Y si ahora no puedes donar, recomendar un disco o compartir la web también ayuda. Gracias por estar aquí.</p>
      </section>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b pb-7 font-mono text-[10px] text-secondary"><span className="inline-flex items-center gap-2"><Heart className="size-3.5" />SIN ANUNCIOS NI RASTREO</span><span className="inline-flex items-center gap-2"><Code2 className="size-3.5" />CÓDIGO ABIERTO</span></div>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">¿Una idea, una duda o simplemente un saludo? Para cualquier contacto, pásate por <a href="https://jprietom.dev" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground underline decoration-primary/50 underline-offset-4 hover:text-primary">jprietom.dev<ArrowUpRight className="size-3.5" /></a>.</p>
    </div>
  </main>;
}

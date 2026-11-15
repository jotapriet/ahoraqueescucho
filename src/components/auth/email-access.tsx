"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestEmailLinkAction } from "@/features/auth/actions";
import { safeReturnTo } from "@/features/auth/redirects";

export function EmailAccess({ redirectTo, standalone = false, disabled = false, initialError = "" }: { redirectTo?: string; standalone?: boolean; disabled?: boolean; initialError?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || disabled || cooldown > 0) return;
    busy.current = true; setMessage("");
    startTransition(async () => {
      try {
        const result = await requestEmailLinkAction({ email, ...(redirectTo ? { next: safeReturnTo(redirectTo) } : {}) });
        if (!result.ok) { setMessage(result.message); return; }
        setSent(true); setCooldown(60); setMessage("Enlace solicitado. Revisa también la carpeta de spam.");
      } catch { setMessage("No se pudo completar el acceso. Vuelve a intentarlo."); }
      finally { busy.current = false; }
    });
  }
  return <section className={standalone ? "rounded-xl border bg-card/30 p-6 sm:p-9" : "mb-7 rounded-lg border border-secondary/30 bg-secondary/5 p-5"} aria-labelledby={`${inputId}-title`}>
    {standalone && <div className="mb-6 flex size-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10"><Mail className="size-5 text-primary" strokeWidth={1.5} /></div>}
    <div className="flex gap-3">{!standalone && <Mail className="mt-1 size-5 shrink-0 text-secondary" strokeWidth={1.5} />}<div className="min-w-0 flex-1">
      <h2 id={`${inputId}-title`} className={standalone ? "text-[30px] leading-tight tracking-tight" : "font-sans text-sm font-semibold"}>{sent ? "Tienes correo del mostrador." : standalone ? "Entra. Ponte cómodo." : "Tu buen gusto merece una firma."}</h2>
      <p className="mt-3 text-xs leading-[1.9] text-muted-foreground">{sent ? <>Hemos solicitado tu acceso para <span className="break-all font-semibold text-foreground">{email}</span>. Abre el enlace del mensaje en este mismo navegador para iniciar sesión. No necesitas introducir ningún código.</> : standalone ? "Solo necesitas tu correo. Te enviaremos un enlace de acceso, sin contraseñas que recordar." : "Accede con tu correo para publicar. Puedes preparar la recomendación mientras tanto."}</p>
      <form onSubmit={submit} className={`mt-5 flex flex-col gap-3 ${standalone ? "" : "sm:flex-row"}`}>
        <div className="min-w-0 flex-1"><label htmlFor={`${inputId}-input`} className={standalone ? "mb-2 block text-xs font-semibold" : "sr-only"}>Correo electrónico</label><input id={`${inputId}-input`} value={email} onChange={event => { setEmail(event.target.value); setSent(false); setMessage(""); }} disabled={pending || disabled} type="email" autoComplete="email" maxLength={254} required placeholder="tu@correo.com" className="h-12 w-full rounded-md border bg-background px-3 text-sm" /></div>
        <Button type="submit" variant={standalone ? "default" : "outline"} className="h-12" disabled={pending || disabled || cooldown > 0}>{pending ? "Enviando…" : cooldown > 0 ? `Reenviar en ${cooldown} s` : sent ? "Reenviar enlace" : "Enviar enlace de acceso"}<ArrowRight /></Button>
      </form>
      <p role="status" className="mt-3 min-h-5 text-xs leading-relaxed text-secondary">{message}</p>
      {standalone && <p className="mt-6 border-t pt-5 text-[10px] leading-relaxed text-muted-foreground">Si es tu primera visita, este acceso también creará tu perfil de curador. Revisa spam si el mensaje tarda en llegar.</p>}
    </div></div>
  </section>;
}

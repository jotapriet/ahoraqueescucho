"use client";
import { ShareRecommendation } from "./share-recommendation";

import { useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Flag, Quote, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar } from "@/components/profile/avatar";
import { contexts, languages, moods } from "@/features/discovery/filters";
import { getReviewsAction, reportRecommendationAction, setVoteAction } from "@/features/recommendations/actions";
import type { ReviewsPage } from "@/features/recommendations/schema";

export function ReviewCarousel({ albumId, initialPage, viewerId, preview = false, highlightedReviewId, loginUrl = "/login" }: { albumId: string; initialPage: ReviewsPage; viewerId: string | null; preview?: boolean; highlightedReviewId?: string; loginUrl?: string }) {
  const [reviews, setReviews] = useState(initialPage.reviews);
  const [index, setIndex] = useState(0);
  const [nextOffset, setNextOffset] = useState(initialPage.nextOffset);
  const [total, setTotal] = useState(initialPage.total);
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const review = reviews[index];
  const own = review?.user_id === viewerId;

  function run(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setMessage("");
    startTransition(async () => {
      try { await work(); }
      catch { setMessage("No se pudo completar el cambio. Inténtalo de nuevo."); }
      finally { busy.current = false; }
    });
  }
  function vote() {
    if (!review) return;
    if (!viewerId) { setMessage("Inicia sesión para dar un Acertado y reconocer a este curador."); return; }
    if (own || preview) return;
    run(async () => {
      const result = await setVoteAction({ recommendationId: review.id, voted: !review.has_voted });
      if (!result.ok) { setMessage(result.message); return; }
      setReviews(current => current.map(item => item.id === review.id ? { ...item, ...result.data } : item));
      setMessage(result.data.has_voted ? "Acertado guardado. Tu voto suma reputación al curador." : "Has retirado tu Acertado.");
    });
  }
  function navigate(delta: number) {
    if (busy.current) return;
    setMessage(""); setReportOpen(false); setReason("");
    if (delta < 0 || index + 1 < reviews.length) { setIndex(current => Math.max(0, Math.min(current + delta, reviews.length - 1))); return; }
    if (nextOffset === null) return;
    run(async () => {
      const result = await getReviewsAction({ albumId, offset: nextOffset });
      if (!result.ok) { setMessage(result.message); return; }
      const unseen = result.data.reviews.filter(item => !reviews.some(existing => existing.id === item.id));
      setReviews(current => [...current, ...unseen]);
      setTotal(result.data.total); setNextOffset(result.data.nextOffset);
      if (unseen.length) setIndex(reviews.length);
      else setMessage("La colección ha cambiado. No hay nuevas reseñas en esta página.");
    });
  }
  function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review || !viewerId || own || preview) return;
    run(async () => {
      const result = await reportRecommendationAction({ recommendationId: review.id, reason });
      if (!result.ok) { setMessage(result.message); return; }
      setReported(current => [...current, review.id]); setReportOpen(false); setReason("");
      setMessage("Gracias. Revisaremos las etiquetas de esta recomendación.");
    });
  }
  return <section aria-label="Reseñas de curadores" aria-roledescription="carrusel" id={highlightedReviewId ? `resena-${highlightedReviewId}` : undefined} className="min-w-0 scroll-mt-8" onKeyDown={event => {
    if ((event.target as HTMLElement).closest("input,textarea,select")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); navigate(event.key === "ArrowRight" ? 1 : -1); }
  }}>
    <div className="mb-5 flex items-center justify-between gap-3"><div><p className="eyebrow mb-2">EL FACTOR HUMANO</p><h2 className="text-[28px] tracking-tight">Alguien lo escuchó. Y pensó en ti.</h2></div><Quote className="hidden size-8 shrink-0 text-primary/45 sm:block" strokeWidth={1} /></div>
    <div className={`rounded-xl border bg-card/45 p-5 sm:p-7 ${review?.id === highlightedReviewId ? "border-primary/60 ring-2 ring-primary/15" : ""}`} aria-busy={pending}>
      {review ? <article aria-roledescription="diapositiva" aria-label={`Reseña ${index + 1} de ${total}`}>
        {review.id === highlightedReviewId && <p className="eyebrow mb-5">ESTA RESEÑA TE HA TRAÍDO HASTA AQUÍ</p>}
        <div className="flex items-center gap-3"><Avatar userId={review.user_id} url={review.avatar_url} nick={review.nick ?? review.display_name} /><div><p className="text-sm font-semibold">{review.nick ? <Link href={`/curadores/${review.nick}`} className="text-primary hover:underline">@{review.nick}</Link> : review.display_name}{own && <span className="ml-2 text-[10px] text-muted-foreground"><Link href="/perfil#aportaciones" className="underline">Gestionar mi reseña</Link></span>}</p><time dateTime={review.created_at} className="font-mono text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(review.created_at))}</time></div><span className="ml-auto text-right font-mono text-[9px] text-muted-foreground">RECOMENDADO<br />DE CORAZÓN</span></div>
        <blockquote className="my-7 min-h-[120px] break-words font-serif text-[24px] leading-[1.55] tracking-tight">«{review.comment}»</blockquote>
        <div className="mb-3 flex flex-wrap gap-1.5">{review.moods.map(mood => <span key={mood} className="rounded-sm border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] text-primary">{moods.find(item => item.value === mood)?.label}</span>)}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-relaxed text-muted-foreground">{review.contexts.map(context => <span key={context}>{contexts.find(item => item.value === context)?.detail}</span>)}<span>Energía {review.energy}/5</span><span>{languages.find(item => item.value === review.language)?.label}</span></div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Button variant="outline" size="sm" onClick={vote} disabled={pending || own || preview} aria-pressed={review.has_voted} aria-label={`${review.has_voted ? "Retirar Acertado" : "Acertado"}: ${review.likes} votos`} className={review.has_voted ? "border-secondary bg-secondary/10 text-secondary" : ""}><ThumbsUp />{review.has_voted ? "Acertado ✓" : "Acertado"}<span className="ml-1 border-l pl-2 font-mono text-xs">{review.likes}</span></Button><button type="button" className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={pending || own || preview || reported.includes(review.id)} onClick={() => { if (!viewerId) { setMessage("Inicia sesión para reportar etiquetas incorrectas."); return; } setReportOpen(current => !current); }}><Flag className="size-3" />{reported.includes(review.id) ? "Reporte enviado" : "Etiquetas incorrectas"}</button></div>
        {!preview && <ShareRecommendation key={review.id} albumId={albumId} reviewId={review.id} />}
        {reportOpen && <form onSubmit={submitReport} className="mt-5 border-t pt-4"><label htmlFor={`report-${review.id}`} className="text-xs font-semibold">¿Qué etiquetas no encajan?</label><textarea id={`report-${review.id}`} value={reason} onChange={event => setReason(event.target.value)} required minLength={5} maxLength={500} rows={3} className="mt-2 w-full rounded-md border bg-background p-3 text-xs" /><div className="mt-2 flex gap-2"><Button size="sm" type="submit" disabled={pending || reason.trim().length < 5}>Enviar reporte</Button><Button size="sm" variant="ghost" type="button" onClick={() => setReportOpen(false)} disabled={pending}>Cancelar</Button></div></form>}
      </article> : <p className="py-12 text-center text-sm text-muted-foreground">Este disco está esperando su primera reseña.</p>}
      <p role="status" className="mt-3 min-h-5 text-xs leading-relaxed text-secondary">{message}</p>
    </div>
    <div className="mt-4 flex items-center justify-between"><p className="text-[10px] text-muted-foreground"><Check className="mr-1 inline size-3 text-secondary" />{highlightedReviewId ? "La reseña compartida primero; después, los Acertados de la comunidad" : "Ordenadas por los Acertados de la comunidad"}</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="size-8" aria-label="Reseña anterior" onClick={() => navigate(-1)} disabled={pending || index === 0}><ChevronLeft /></Button><span aria-live="polite" className="min-w-10 text-center font-mono text-[10px]">{review ? index + 1 : 0} / {total}</span><Button variant="outline" size="icon" className="size-8" aria-label="Reseña siguiente" onClick={() => navigate(1)} disabled={pending || (!review || (index >= reviews.length - 1 && nextOffset === null))}><ChevronRight /></Button></div></div>
    {!viewerId && <p className="mt-3 text-[10px] text-muted-foreground">Puedes leer todas las reseñas. <Link href={loginUrl} className="font-semibold text-primary underline underline-offset-4">Inicia sesión</Link> para votar, guardar o reportar.</p>}
  </section>;
}

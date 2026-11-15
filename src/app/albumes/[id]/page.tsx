import type { Metadata } from "next";
import { getSharedAlbum, getSharedReview } from "@/features/recommendations/share-data";
import { recommendationPath, prioritizeSharedReview } from "@/features/recommendations/share";
import Link from "next/link";
import { SurprisePicker } from "@/components/discovery/surprise-picker";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeCoverUrl } from "@/lib/music/urls";
import { AlbumArtwork } from "@/components/album-artwork";
import { ListeningPlatforms } from "@/components/listening-platforms";
import { ReviewCarousel } from "@/components/recommendations/review-carousel";
import { getReviews } from "@/features/recommendations/queries";
import { getAuthState } from "@/features/auth/session";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ sorpresa?: string; sinEscuchados?: string; resena?: string }> };
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const album = await getSharedAlbum(id);
  if (!album) notFound();
  const { resena } = await searchParams;
  const review = await getSharedReview(id, resena);
  const curator = review ? review.nick ? '@' + review.nick : review.display_name : null;
  const title = curator ? album.title + ' · Recomendado por ' + curator : album.title + ' · ' + album.artists.join(', ');
  const description = review ? '«' + review.comment + '» — ' + curator : 'Escucha ' + album.title + ' de ' + album.artists.join(', ') + ', de principio a fin.';
  const origin = new URL(process.env.APP_URL || 'http://localhost:3000');
  const path = review ? recommendationPath(id, review.id).split('#')[0] : '/albumes/' + id;
  const image = new URL('/albumes/' + id + '/vista-previa' + (review ? '?resena=' + review.id : ''), origin).toString();
  return { title: title + ' · Ahora qué escucho', description, openGraph: { title, description, type: 'website', locale: 'es_ES', siteName: 'Ahora qué escucho', url: new URL(path, origin).toString(), images: [{ url: image, width: 1200, height: 630, alt: title }] }, twitter: { card: 'summary_large_image', title, description, images: [image] } };
}
export default async function AlbumPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: album, error } = await supabase.from("albums").select("id,title,artists,release_year,genres,cover_url,source_url,platform_links,deezer_id,spotify_id,musicbrainz_id").eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar el álbum. Inténtalo de nuevo.");
  if (!album) notFound();
  const [{ viewer }, reviews, sharedReview] = await Promise.all([getAuthState(), getReviews(id), getSharedReview(id, query.resena)]);
  const initialReviews = prioritizeSharedReview(reviews, sharedReview);
  return <main id="main-content" className="site-container py-10"><Link href="/#coleccion" className="text-xs text-muted-foreground hover:text-foreground">← Volver a la colección</Link><div className="mt-9 grid items-start gap-10 md:grid-cols-2 lg:gap-20"><section className="min-w-0"><div className="album-sleeve mx-auto max-w-sm"><AlbumArtwork url={safeCoverUrl(album.cover_url ?? undefined)} title={album.title} /></div><p className="mt-7 font-mono text-xs text-muted-foreground">{album.release_year ?? "SIN FECHA"} · ÁLBUM COMPLETO</p><h1 className="mt-3 break-words text-4xl leading-tight">{album.title}</h1><p className="mt-3 text-lg text-muted-foreground">{album.artists.join(", ")}</p><p className="mt-3 text-xs text-muted-foreground">{album.genres.join(" · ")}</p>{album.musicbrainz_id && <p className="mt-5 text-[10px] text-muted-foreground">Metadatos: <a href={`https://musicbrainz.org/release-group/${album.musicbrainz_id}`} target="_blank" rel="noopener noreferrer" className="underline">MusicBrainz</a> · Portadas: Cover Art Archive</p>}</section><Suspense fallback={<section role="status" className="rounded-xl border bg-card/40 p-8"><h2 className="text-3xl">Escúchalo a tu manera.</h2><p className="mt-4 text-sm text-muted-foreground">Buscando enlaces de escucha…</p></section>}><ListeningPlatforms album={album} /></Suspense></div>{query.sorpresa === "1" && <SurprisePicker signedIn={!!viewer} initialExcludeListened={query.sinEscuchados === "1"} again />}<div className="mt-16 max-w-3xl">{query.resena && !sharedReview && <p role="status" className="mb-5 rounded-md border p-4 text-sm text-muted-foreground">La reseña compartida ya no está disponible para este álbum. Puedes leer las demás recomendaciones.</p>}<ReviewCarousel key={sharedReview?.id ?? "all"} highlightedReviewId={sharedReview?.id} albumId={id} initialPage={initialReviews} viewerId={viewer?.id ?? null} loginUrl={`/login?${new URLSearchParams({ next: sharedReview ? recommendationPath(id, sharedReview.id) : `/albumes/${id}` })}`} /></div></main>;
}

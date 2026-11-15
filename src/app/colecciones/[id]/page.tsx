import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPublicCollection } from "@/features/collections/queries";
import { getAuthState } from "@/features/auth/session";
import { AlbumArtwork } from "@/components/album-artwork";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/profile/avatar";
import { ShareCollection, DeleteCollection } from "@/components/collections/collection-controls";
import { safeCoverUrl } from "@/lib/music/urls";
type Props = { params: Promise<{ id: string }> };
async function load(params: Props["params"]) { const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const collection = await getPublicCollection(id); if (!collection) notFound(); return collection; }
export async function generateMetadata({ params }: Props) { const collection = await load(params); return { title: `${collection.title} · Ahora qué escucho`, description: collection.introduction.slice(0, 160) }; }
export default async function CollectionPage({ params }: Props) {
  const collection = await load(params);
  const { viewer } = await getAuthState();
  const own = viewer?.id === collection.user_id;
  const albums = [...collection.curator_collection_albums].sort((a, b) => a.position - b.position);
  return <main id="main-content" className="site-container py-10"><Link href="/colecciones" className="text-sm text-muted-foreground hover:text-primary">← Todas las colecciones</Link><header className="my-10 max-w-3xl"><p className="eyebrow mb-3">{albums.length} DISCOS · UNA SELECCIÓN HUMANA</p><h1 className="break-words text-4xl sm:text-5xl">{collection.title}</h1><p className="my-6 whitespace-pre-wrap break-words text-base leading-relaxed text-muted-foreground">{collection.introduction}</p>{collection.profiles.nick && <Link href={`/curadores/${collection.profiles.nick}`} className="mb-6 flex w-fit items-center gap-3 text-sm text-primary"><Avatar userId={collection.user_id} nick={collection.profiles.nick} url={collection.profiles.avatar_url} />Una selección de @{collection.profiles.nick}</Link>}<div className="flex flex-wrap items-start gap-4"><ShareCollection id={collection.id} />{own && <Button asChild variant="outline"><Link href={`/colecciones/${collection.id}/editar`}>Editar mi colección</Link></Button>}</div></header><ol className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">{albums.map(({ position, albums: album }) => <li key={album.id} className="min-w-0 rounded-xl border bg-card/40 p-5"><Link href={`/albumes/${album.id}`} className="album-sleeve block aspect-square"><AlbumArtwork url={safeCoverUrl(album.cover_url ?? undefined)} title={album.title} className="album-cover aspect-square w-full rounded-md object-cover" /></Link><p className="mb-2 mt-5 font-mono text-xs text-secondary">LADO {String(position).padStart(2, "0")}</p><h2 className="break-words text-2xl"><Link href={`/albumes/${album.id}`} className="hover:text-primary">{album.title}</Link></h2><p className="my-3 text-sm text-muted-foreground">{album.artists.join(", ")}</p><Link href={`/albumes/${album.id}`} className="text-sm text-primary underline">Dónde escucharlo →</Link></li>)}</ol>{own && <DeleteCollection id={collection.id} />}</main>;
}

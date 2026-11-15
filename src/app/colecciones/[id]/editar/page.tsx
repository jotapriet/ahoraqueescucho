import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getAuthState } from "@/features/auth/session";
import { loginHref } from "@/features/auth/redirects";
import { getPublicCollection } from "@/features/collections/queries";
import { CollectionEditor } from "@/components/collections/collection-editor";
import { safeCoverUrl } from "@/lib/music/urls";
export const metadata = { title: "Editar colección · Ahora qué escucho" };
export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { viewer } = await getAuthState();
  if (!viewer) redirect(loginHref(`/colecciones/${id}/editar`));
  const collection = await getPublicCollection(id);
  if (!collection || collection.user_id !== viewer.id) notFound();
  const albums = [...collection.curator_collection_albums].sort((a, b) => a.position - b.position).map(({ albums: album }) => ({ ...album, cover_url: safeCoverUrl(album.cover_url ?? undefined) }));
  return <main id="main-content" className="site-container py-10"><div className="mx-auto max-w-3xl"><p className="eyebrow mb-3">TU SELECCIÓN, A TU MANERA</p><h1 className="text-4xl">Editar colección.</h1><CollectionEditor initial={{ id, title: collection.title, introduction: collection.introduction, albums }} /></div></main>;
}

"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeCoverUrl } from "@/lib/music/urls";
import { collectionAlbumSchema, collectionInput, type CollectionAlbum, type CollectionMutation } from "./schema";

export async function saveCollectionAction(input: unknown): Promise<CollectionMutation> {
  const parsed = collectionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa el título, la introducción y la selección de entre 2 y 12 discos sin repetir." };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, message: "Inicia sesión para publicar una colección." };
    const { data, error } = await supabase.rpc("save_curator_collection", { p_id: parsed.data.id, p_title: parsed.data.title, p_introduction: parsed.data.introduction, p_album_ids: parsed.data.albumIds });
    if (error) return { ok: false, message: error.code === "42501" ? "Solo su autor puede editar esta colección." : error.code === "23514" ? "Elige primero tu nick en Mi perfil." : error.code === "P0002" ? "Algún disco ya no está disponible en la colección. Revisa la selección." : "No se pudo publicar. Tu selección sigue en el formulario." };
    if (data !== parsed.data.id) throw new Error("Invalid collection result");
    revalidatePath("/colecciones", "layout"); revalidatePath("/perfil"); revalidatePath("/curadores/[nick]", "page");
    return { ok: true, id: parsed.data.id };
  } catch { return { ok: false, message: "No se pudo publicar. Tu selección sigue en el formulario." }; }
}
export async function deleteCollectionAction(input: unknown): Promise<CollectionMutation> {
  const parsed = z.object({ id: z.uuid() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: "La colección no es válida." };
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, message: "Inicia sesión para eliminar tu colección." };
    const { data, error } = await supabase.rpc("delete_curator_collection", { p_id: parsed.data.id });
    if (error || typeof data !== "boolean") return { ok: false, message: "No se pudo eliminar la colección. Solo su autor puede hacerlo." };
    revalidatePath("/colecciones", "layout"); revalidatePath("/perfil"); revalidatePath("/curadores/[nick]", "page");
    return { ok: true, id: parsed.data.id };
  } catch { return { ok: false, message: "No se pudo eliminar la colección. Inténtalo de nuevo." }; }
}
export async function searchCollectionAlbumsAction(input: unknown): Promise<{ ok: true; albums: CollectionAlbum[] } | { ok: false; message: string }> {
  const parsed = z.object({ query: z.string().trim().max(120) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, message: "Escribe una búsqueda de hasta 120 caracteres." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_collection_albums", { p_query: parsed.data.query });
    const albums = collectionAlbumSchema.array().max(12).safeParse(data);
    if (error || !albums.success) throw new Error("Collection search unavailable");
    return { ok: true, albums: albums.data.map(album => ({ ...album, cover_url: safeCoverUrl(album.cover_url ?? undefined) })) };
  } catch { return { ok: false, message: "No se pudieron buscar discos. Vuelve a intentarlo." }; }
}

import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { collectionAlbumSchema } from "./schema";

export const collectionSchema = z.object({ id: z.uuid(), user_id: z.uuid(), title: z.string(), introduction: z.string(), updated_at: z.string(), profiles: z.object({ nick: z.string().nullable(), avatar_url: z.string().nullable() }), curator_collection_albums: z.array(z.object({ position: z.number(), albums: collectionAlbumSchema })) });
export type PublicCollection = z.infer<typeof collectionSchema>;
const selection = "id,user_id,title,introduction,updated_at,profiles!inner(nick,avatar_url),curator_collection_albums(position,albums!inner(id,title,artists,cover_url))";

export const getPublicCollection = cache(async (id: string): Promise<PublicCollection | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("curator_collections").select(selection).eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar la colección.");
  if (!data) return null;
  return collectionSchema.parse(data);
});
export async function getPublicCollections(page: number, userId?: string) {
  const supabase = await createClient();
  let query = supabase.from("curator_collections").select(selection, { count: "exact" });
  if (userId) query = query.eq("user_id", userId);
  const { data, error, count } = await query.order("updated_at", { ascending: false }).order("id").range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error("No se pudieron cargar las colecciones.");
  return { collections: collectionSchema.array().parse(data), total: count ?? 0 };
}
export function collectionPage(value: string | undefined) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 10000 ? page : 1;
}

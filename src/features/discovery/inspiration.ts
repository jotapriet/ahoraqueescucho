import "server-only";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { safeAlbumSourceUrl, safeCoverUrl } from "@/lib/music/urls";

const schema = z.array(z.object({ id: z.uuid(), title: z.string(), artists: z.array(z.string()), release_year: z.number().nullable(), cover_url: z.string().nullable(), source_url: z.string() })).max(3);
export async function getInspirationAlbums() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("random_inspiration_albums");
    const parsed = schema.safeParse(data);
    if (error || !parsed.success) return { available: false, albums: [] };
    return { available: true, albums: parsed.data.map(album => ({ ...album, cover_url: safeCoverUrl(album.cover_url ?? undefined), source_url: safeAlbumSourceUrl(album.source_url) })) };
  } catch { return { available: false, albums: [] }; }
}

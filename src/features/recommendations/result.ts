import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { moods, type DiscoveryFilters } from "@/features/discovery/filters";
import { safeAlbumSourceUrl, safeCoverUrl, safePlatformUrl } from "@/lib/music/urls";
import type { Platform, PlatformLinks } from "@/lib/music/types";
import { getReviews } from "./queries";
import type { ReviewsPage } from "./schema";

export type ResultAlbum = { id: string; title: string; artists: string[]; year: number | null; genres: string[]; vibes: DiscoveryFilters["moods"]; coverUrl: string | null; links: PlatformLinks; sourceUrl?: string | null };
export type RecommendationResult = { album: ResultAlbum; reviews: ReviewsPage; viewerId: string | null; saved: boolean };
export type ResultState = { status: "ready"; result: RecommendationResult } | { status: "empty" | "unavailable" };
const albumSchema = z.object({ id: z.uuid(), title: z.string(), artists: z.array(z.string()), release_year: z.number().nullable(), genres: z.array(z.string()), cover_url: z.string().nullable(), source_url: z.string(), platform_links: z.record(z.string(), z.unknown()) });

export function parseExcluded(value: string | string[] | undefined): string[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return [...new Set(values.filter(id => z.uuid().safeParse(id).success))].slice(0, 200);
}

export async function getRecommendationResult(filters: DiscoveryFilters, excluded: string[]): Promise<ResultState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) return { status: "unavailable" };
  try {
    const supabase = await createClient();
    const matches = await supabase.rpc("discover_albums", { p_context: filters.context, p_energy: filters.energy, p_moods: filters.moods, p_language: filters.language === "any" ? null : filters.language, p_excluded: excluded, p_limit: 1 });
    const parsed = z.array(z.object({ album_id: z.uuid() })).safeParse(matches.data);
    if (matches.error || !parsed.success) return { status: "unavailable" };
    if (!parsed.data.length) return { status: "empty" };
    const id = parsed.data[0].album_id;
    const [albumResponse, reviews, authResponse, vibeResponse] = await Promise.all([
      supabase.from("albums").select("id,title,artists,release_year,genres,cover_url,source_url,platform_links").eq("id", id).single(),
      getReviews(id), supabase.auth.getUser(),
      supabase.from("album_mood_stats").select("mood").eq("album_id", id).order("recommendations", { ascending: false }).order("mood").limit(3),
    ]);
    const album = albumSchema.safeParse(albumResponse.data);
    if (albumResponse.error || !album.success) return { status: "unavailable" };
    const vibes = z.array(z.object({ mood: z.enum(moods.map(item => item.value)) })).safeParse(vibeResponse.data);
    if (vibeResponse.error || !vibes.success) return { status: "unavailable" };
    const viewerId = authResponse.error ? null : authResponse.data.user?.id ?? null;
    let saved = false;
    if (viewerId) {
      const response = await supabase.from("saved_albums").select("album_id").eq("user_id", viewerId).eq("album_id", id).maybeSingle();
      if (response.error) return { status: "unavailable" };
      saved = !!response.data;
    }
    const links: PlatformLinks = {};
    for (const platform of ["spotify", "appleMusic", "youtubeMusic", "bandcamp", "tidal"] as Platform[]) {
      const value = album.data.platform_links[platform];
      const safe = typeof value === "string" ? safePlatformUrl(platform, value) : null;
      if (safe) links[platform] = safe;
    }
    return { status: "ready", result: { album: { id, title: album.data.title, artists: album.data.artists, year: album.data.release_year, genres: album.data.genres, vibes: vibes.data.map(item => item.mood), coverUrl: safeCoverUrl(album.data.cover_url ?? undefined), sourceUrl: safeAlbumSourceUrl(album.data.source_url), links }, reviews, viewerId, saved } };
  } catch { return { status: "unavailable" }; }
}

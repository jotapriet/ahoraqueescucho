import "server-only";
import { z } from "zod";
import { MusicError } from "./errors";
import { fetchJson } from "./http";
import type { AlbumReference, Platform, PlatformLinks, ResolvedLinks } from "./types";
import { albumSourceUrl, safePlatformUrl } from "./urls";

const responseSchema = z.object({
  entitiesByUniqueId: z.record(z.string(), z.object({ type: z.string() })),
  linksByPlatform: z.record(z.string(), z.object({ url: z.string(), entityUniqueId: z.string() })),
});
const platforms: readonly Platform[] = ["spotify", "appleMusic", "youtubeMusic", "bandcamp", "tidal"];

export async function resolveOdesliLinks(album: AlbumReference): Promise<ResolvedLinks> {
  const url = new URL("https://api.song.link/v1-alpha.1/links");
  url.searchParams.set("url", albumSourceUrl(album));
  url.searchParams.set("userCountry", "ES");
  if (process.env.ODESLI_API_KEY) url.searchParams.set("key", process.env.ODESLI_API_KEY);
  const parsed = responseSchema.safeParse(await fetchJson(url));
  if (!parsed.success) throw new MusicError("INVALID_RESPONSE", "Odesli devolvió enlaces no válidos.");
  const links: PlatformLinks = {};
  for (const platform of platforms) {
    const link = parsed.data.linksByPlatform[platform];
    // No enlazar una canción individual cuando se recomienda un álbum completo.
    if (!link || parsed.data.entitiesByUniqueId[link.entityUniqueId]?.type !== "album") continue;
    const safeUrl = safePlatformUrl(platform, link.url);
    if (safeUrl) links[platform] = safeUrl;
  }
  return { links, resolvedAt: new Date().toISOString() };
}

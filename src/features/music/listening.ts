import "server-only";
import { unstable_cache } from "next/cache";
import { getAlbumLinksAction } from "./actions";
import { matchMusicBrainzAlbum, getMusicBrainzLinks } from "@/lib/music/musicbrainz";
import { safeAlbumSourceUrl, safePlatformUrl } from "@/lib/music/urls";
import type { Platform, PlatformLinks } from "@/lib/music/types";

export const platformNames = { spotify: "Spotify", appleMusic: "Apple Music", youtubeMusic: "YouTube Music", bandcamp: "Bandcamp", tidal: "Tidal", deezer: "Deezer" };
export type ListeningAlbum = { id: string; title: string; artists: string[]; release_year: number | null; deezer_id: string | null; spotify_id: string | null; musicbrainz_id: string | null; source_url: string; platform_links: Record<string, unknown> };

export const getListeningLinks = unstable_cache(async (album: ListeningAlbum) => {
  const links: PlatformLinks & { deezer?: string } = {};
  for (const platform of ["spotify", "appleMusic", "youtubeMusic", "bandcamp", "tidal"] as Platform[]) {
    const value = album.platform_links[platform];
    if (typeof value === "string") { const safe = safePlatformUrl(platform, value); if (safe) links[platform] = safe; }
  }
  if (album.deezer_id && /^[1-9][0-9]{0,19}$/.test(album.deezer_id)) links.deezer = `https://www.deezer.com/album/${album.deezer_id}`;
  if (album.spotify_id && /^[A-Za-z0-9]{22}$/.test(album.spotify_id)) links.spotify ??= `https://open.spotify.com/album/${album.spotify_id}`;
  const source = safeAlbumSourceUrl(album.source_url);
  if (source && ["deezer.com", "www.deezer.com"].includes(new URL(source).hostname)) links.deezer ??= source;
  let resolved = false;
  try {
    const ref = album.musicbrainz_id ? { provider: "musicbrainz" as const, id: album.musicbrainz_id } : album.deezer_id ? { provider: "deezer" as const, id: album.deezer_id } : album.spotify_id ? { provider: "spotify" as const, id: album.spotify_id } : null;
    if (ref) {
      const result = await getAlbumLinksAction(ref);
      if (result.ok) { Object.assign(links, result.data.links); resolved = Object.keys(result.data.links).length > 0; }
    }
    if (!resolved && !album.musicbrainz_id) {
      const match = await matchMusicBrainzAlbum(album.title, album.artists, album.release_year);
      if (match) Object.assign(links, (await getMusicBrainzLinks(match)).links);
    }
  } catch { /* Los enlaces ya confirmados siguen siendo útiles si falla otra fuente. */ }
  return links;
}, ["album-listening-links-v1"], { revalidate: 3600 });

export function platformSearches(title: string, artists: string[]) {
  const query = `${artists[0] ?? ""} ${title}`.trim();
  return [
    { name: "Spotify", url: `https://open.spotify.com/search/${encodeURIComponent(query)}/albums` },
    { name: "Apple Music", url: `https://music.apple.com/es/search?${new URLSearchParams({ term: query })}` },
    { name: "YouTube Music", url: `https://music.youtube.com/search?${new URLSearchParams({ q: query })}` },
    { name: "Bandcamp", url: `https://bandcamp.com/search?${new URLSearchParams({ q: query, item_type: "a" })}` },
    { name: "Tidal", url: `https://listen.tidal.com/search?${new URLSearchParams({ q: query })}` },
  ];
}

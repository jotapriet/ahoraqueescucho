import type { AlbumReference, Platform } from "./types";

export function albumSourceUrl(album: AlbumReference): string {
  if (album.provider === "musicbrainz") return `https://musicbrainz.org/release-group/${album.id}`;
  return album.provider === "spotify"
    ? `https://open.spotify.com/album/${album.id}`
    : `https://www.deezer.com/album/${album.id}`;
}

const platformHosts: Record<Platform, readonly string[]> = {
  spotify: ["open.spotify.com"],
  appleMusic: ["music.apple.com"],
  youtubeMusic: ["music.youtube.com"],
  bandcamp: ["bandcamp.com"],
  tidal: ["tidal.com", "listen.tidal.com"],
};

export function safePlatformUrl(platform: Platform, value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const allowed = platformHosts[platform].includes(url.hostname)
      || (platform === "bandcamp" && url.hostname.endsWith(".bandcamp.com"));
    return allowed ? url.href : null;
  } catch { return null; }
}

export function safeCoverUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return (["i.scdn.co", "cdn-images.dzcdn.net", "e-cdns-images.dzcdn.net"].includes(url.hostname)
      || (url.hostname === "coverartarchive.org" && /^\/release-group\/[a-f0-9-]{36}\/front-(250|500|1200)$/.test(url.pathname)))
      ? url.href : null;
  } catch { return null; }
}

export function safeAlbumSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname === "open.spotify.com" && /^\/album\/[A-Za-z0-9]{22}$/.test(url.pathname)) return url.href;
    if (url.hostname === "musicbrainz.org" && /^\/release-group\/[a-f0-9-]{36}$/.test(url.pathname)) return url.href;
    if (["www.deezer.com", "deezer.com"].includes(url.hostname) && /^\/(?:[a-z]{2}\/)?album\/[0-9]+$/.test(url.pathname)) return url.href;
    return null;
  } catch { return null; }
}

export function releaseYear(date: string | undefined): number | null {
  if (!date || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  return year >= 1800 && year <= 2200 ? year : null;
}

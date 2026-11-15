import "server-only";
import { z } from "zod";
import { MusicError } from "./errors";
import { fetchJson } from "./http";
import type { MusicAlbum } from "./types";
import { albumSourceUrl, releaseYear, safeCoverUrl } from "./urls";

const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string(), expires_in: z.number().positive() });
let tokenCache: { value: string; expiresAt: number } | undefined;
let pendingToken: Promise<string> | undefined;

async function requestToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new MusicError("CONFIGURATION", "Spotify no está configurado. Puedes buscar en Deezer.");
  const data = await fetchJson("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const parsed = tokenSchema.safeParse(data);
  if (!parsed.success || parsed.data.token_type.toLowerCase() !== "bearer") throw new MusicError("INVALID_RESPONSE", "Spotify devolvió una autorización no válida.");
  tokenCache = { value: parsed.data.access_token, expiresAt: Date.now() + Math.max(0, parsed.data.expires_in - 60) * 1000 };
  return tokenCache.value;
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  // Una sola renovación simultánea por proceso; nunca enviar este token al navegador.
  if (!pendingToken) pendingToken = requestToken().finally(() => { pendingToken = undefined; });
  return pendingToken;
}

const albumSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{22}$/),
  name: z.string().trim().min(1),
  artists: z.array(z.object({ name: z.string().trim().min(1) })).min(1),
  release_date: z.string().optional(),
  images: z.array(z.object({ url: z.string(), width: z.number().nullable().optional() })),
  genres: z.array(z.string()).optional(),
});

function normalize(album: z.infer<typeof albumSchema>): MusicAlbum {
  const ref = { provider: "spotify" as const, id: album.id };
  return {
    ...ref, title: album.name, artists: album.artists.map(a => a.name),
    releaseYear: releaseYear(album.release_date), genres: album.genres ?? [],
    coverUrl: [...album.images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
      .map(image => safeCoverUrl(image.url)).find(url => url !== null) ?? null,
    sourceUrl: albumSourceUrl(ref),
  };
}

export async function searchSpotifyAlbums(query: string, limit: number): Promise<MusicAlbum[]> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.search = new URLSearchParams({ q: query, type: "album", limit: String(limit), market: "ES" }).toString();
  const data = await fetchJson(url, { headers: { Authorization: `Bearer ${await getToken()}` } });
  const parsed = z.object({ albums: z.object({ items: z.array(albumSchema) }) }).safeParse(data);
  if (!parsed.success) throw new MusicError("INVALID_RESPONSE", "Spotify devolvió un catálogo no válido.");
  return parsed.data.albums.items.slice(0, limit).map(normalize);
}

export async function getSpotifyAlbum(id: string): Promise<MusicAlbum> {
  const url = new URL(`https://api.spotify.com/v1/albums/${id}`);
  url.searchParams.set("market", "ES");
  const data = await fetchJson(url, { headers: { Authorization: `Bearer ${await getToken()}` } });
  const parsed = albumSchema.safeParse(data);
  if (!parsed.success || parsed.data.id !== id) throw new MusicError("INVALID_RESPONSE", "Spotify devolvió un álbum no válido.");
  return normalize(parsed.data);
}

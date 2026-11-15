import "server-only";
import { z } from "zod";
import { MusicError } from "./errors";
import { fetchJson } from "./http";
import type { MusicAlbum } from "./types";
import { albumSourceUrl, releaseYear, safeCoverUrl } from "./urls";

const artistSchema = z.object({ name: z.string().trim().min(1) });
const albumSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  title: z.string().trim().min(1),
  artist: artistSchema,
  contributors: z.array(artistSchema).optional(),
  release_date: z.string().optional(),
  cover_xl: z.string().optional(),
  cover_big: z.string().optional(),
  genres: z.object({ data: z.array(z.object({ name: z.string() })) }).optional(),
});

function normalize(album: z.infer<typeof albumSchema>): MusicAlbum {
  const ref = { provider: "deezer" as const, id: String(album.id) };
  return {
    ...ref, title: album.title,
    artists: [...new Set([album.artist.name, ...(album.contributors ?? []).map(a => a.name)])],
    releaseYear: releaseYear(album.release_date),
    genres: [...new Set((album.genres?.data ?? []).map(g => g.name))],
    coverUrl: safeCoverUrl(album.cover_xl) ?? safeCoverUrl(album.cover_big),
    sourceUrl: albumSourceUrl(ref),
  };
}

function assertNoDeezerError(data: unknown) {
  const parsed = z.object({ error: z.object({ code: z.number() }) }).safeParse(data);
  if (parsed.success) {
    if (parsed.data.error.code === 800) throw new MusicError("NOT_FOUND", "No se ha encontrado el álbum.");
    if (parsed.data.error.code === 4) throw new MusicError("RATE_LIMITED", "Deezer ha limitado las consultas.", 60);
    throw new MusicError("UNAVAILABLE", "Deezer no está disponible.");
  }
}

export async function searchDeezerAlbums(query: string, limit: number): Promise<MusicAlbum[]> {
  const url = new URL("https://api.deezer.com/search/album");
  url.search = new URLSearchParams({ q: query, limit: String(limit) }).toString();
  const data = await fetchJson(url);
  assertNoDeezerError(data);
  const parsed = z.object({ data: z.array(albumSchema) }).safeParse(data);
  if (!parsed.success) throw new MusicError("INVALID_RESPONSE", "Deezer devolvió un catálogo no válido.");
  // El buscador no siempre incluye año/géneros: se completan al seleccionar un álbum.
  return parsed.data.data.slice(0, limit).map(normalize);
}

export async function getDeezerAlbum(id: string): Promise<MusicAlbum> {
  const data = await fetchJson(`https://api.deezer.com/album/${id}`);
  assertNoDeezerError(data);
  const parsed = albumSchema.safeParse(data);
  if (!parsed.success || String(parsed.data.id) !== id) throw new MusicError("INVALID_RESPONSE", "Deezer devolvió un álbum no válido.");
  return normalize(parsed.data);
}

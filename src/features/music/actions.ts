"use server";

import { unstable_cache } from "next/cache";
import { getDeezerAlbum, searchDeezerAlbums } from "../../lib/music/deezer";
import { getMusicBrainzAlbum, searchMusicBrainzAlbums, getMusicBrainzLinks } from "@/lib/music/musicbrainz";
import { getSpotifyAlbum, searchSpotifyAlbums } from "../../lib/music/spotify";
import { resolveOdesliLinks } from "../../lib/music/odesli";
import { actionFailure } from "../../lib/music/errors";
import { albumReferenceSchema, searchAlbumsSchema } from "../../lib/music/validation";
import type { ActionResult, MusicAlbum, ResolvedLinks, MusicProvider } from "../../lib/music/types";

// Caché compartida de datos públicos. Los fallos lanzados no se guardan como resultados.
const searchCached = unstable_cache(async (query: string, provider: MusicProvider, limit: number) =>
  provider === "musicbrainz" ? searchMusicBrainzAlbums(query, limit) : provider === "deezer" ? searchDeezerAlbums(query, limit) : searchSpotifyAlbums(query, limit),
  ["album-search-v2"], { revalidate: 300 });

const albumCached = unstable_cache(async (provider: MusicProvider, id: string) =>
  provider === "musicbrainz" ? getMusicBrainzAlbum(id) : provider === "deezer" ? getDeezerAlbum(id) : getSpotifyAlbum(id),
  ["album-detail-v1"], { revalidate: 3600 });

const linksCached = unstable_cache(async (provider: MusicProvider, id: string) =>
  provider === "musicbrainz" ? getMusicBrainzLinks(await albumCached(provider, id)) : resolveOdesliLinks({ provider, id }), ["album-links-v1"], { revalidate: 86400 });

export async function searchAlbumsAction(input: unknown): Promise<ActionResult<MusicAlbum[]>> {
  const parsed = searchAlbumsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "Escribe entre 2 y 120 caracteres y elige un proveedor válido (máximo 10 resultados)." } };
  try {
    const { query, provider, limit } = parsed.data;
    return { ok: true, data: await searchCached(query, provider, limit) };
  } catch (error) { return actionFailure(error); }
}

export async function getAlbumAction(input: unknown): Promise<ActionResult<MusicAlbum>> {
  const parsed = albumReferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "El identificador del álbum no es válido." } };
  try {
    return { ok: true, data: await albumCached(parsed.data.provider, parsed.data.id) };
  } catch (error) { return actionFailure(error); }
}

export async function getAlbumLinksAction(input: unknown): Promise<ActionResult<ResolvedLinks>> {
  const parsed = albumReferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_INPUT", message: "El identificador del álbum no es válido." } };
  try {
    return { ok: true, data: await linksCached(parsed.data.provider, parsed.data.id) };
  } catch (error) { return actionFailure(error); }
}

export type MusicProvider = "deezer" | "spotify" | "musicbrainz";
export type AlbumReference = { provider: MusicProvider; id: string };
export type Platform = "spotify" | "appleMusic" | "youtubeMusic" | "bandcamp" | "tidal";
export type PlatformLinks = Partial<Record<Platform, string>>;

export type MusicAlbum = AlbumReference & {
  title: string;
  artists: string[];
  releaseYear: number | null;
  genres: string[];
  coverUrl: string | null;
  sourceUrl: string;
  links?: PlatformLinks;
};

export type MusicErrorCode = "INVALID_INPUT" | "CONFIGURATION" | "RATE_LIMITED" | "UNAVAILABLE" | "NOT_FOUND" | "INVALID_RESPONSE";
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: MusicErrorCode; message: string; retryAfterSeconds?: number } };

export type ResolvedLinks = {
  links: PlatformLinks;
  // No confundir «no hay enlaces disponibles» con un fallo HTTP de Odesli.
  resolvedAt: string;
};

import "server-only";
import type { MusicProvider } from "@/lib/music/types";

export function getCatalogProvider(): MusicProvider {
  const provider = process.env.MUSIC_CATALOG_PROVIDER ?? "deezer";
  if (provider !== "deezer" && provider !== "spotify" && provider !== "musicbrainz") throw new Error("Proveedor no válido.");
  return provider;
}

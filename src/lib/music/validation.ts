import { z } from "zod";

export const albumReferenceSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("musicbrainz"), id: z.uuid() }),
  z.object({ provider: z.literal("spotify"), id: z.string().regex(/^[A-Za-z0-9]{22}$/) }),
  z.object({ provider: z.literal("deezer"), id: z.string().regex(/^[1-9][0-9]{0,19}$/) }),
]);

export const searchAlbumsSchema = z.object({
  query: z.string().trim().min(2).max(120).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  provider: z.enum(["deezer", "spotify", "musicbrainz"]).default("deezer"),
  limit: z.number().int().min(1).max(10).default(8),
});

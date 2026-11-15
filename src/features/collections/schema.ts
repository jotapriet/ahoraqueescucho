import { z } from "zod";

export const collectionInput = z.object({
  id: z.uuid(),
  title: z.string().trim().refine(value => [...value].length >= 3 && [...value].length <= 100),
  introduction: z.string().trim().refine(value => [...value].length >= 1 && [...value].length <= 1000),
  albumIds: z.array(z.uuid()).min(2).max(12).refine(ids => new Set(ids).size === ids.length),
}).strict();
export const collectionAlbumSchema = z.object({ id: z.uuid(), title: z.string(), artists: z.array(z.string()), cover_url: z.string().nullable() });
export type CollectionAlbum = z.infer<typeof collectionAlbumSchema>;
export type CollectionDraft = { id: string; title: string; introduction: string; albums: CollectionAlbum[] };
export type CollectionMutation = { ok: true; id: string } | { ok: false; message: string };

import { z } from "zod";
import { contexts, moods } from "@/features/discovery/filters";
import { albumReferenceSchema } from "@/lib/music/validation";

export const contributionSchema = z.object({
  album: albumReferenceSchema,
  contexts: z.array(z.enum(contexts.map(item => item.value))).min(1).max(5).transform(items => [...new Set(items)]),
  energy: z.number().int().min(1).max(5),
  moods: z.array(z.enum(moods.map(item => item.value))).min(1).max(6).transform(items => [...new Set(items)]),
  language: z.enum(["instrumental", "es", "en", "other"]),
  comment: z.string().trim().min(1).refine(value => [...value].length <= 280, "Máximo 280 caracteres"),
}).strict();
export type Contribution = z.infer<typeof contributionSchema>;
export type PublishResult = { ok: true; data: { albumId: string; recommendationId: string; created: boolean; linksPending: boolean } } | { ok: false; code: "INVALID_INPUT" | "AUTH_REQUIRED" | "UNAVAILABLE" | "CATALOG_ERROR"; message: string };

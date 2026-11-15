import { z } from "zod";
import { contexts, moods } from "@/features/discovery/filters";

export const reviewSchema = z.object({
  id: z.uuid(), album_id: z.uuid(), user_id: z.uuid(), display_name: z.string(), nick: z.string().nullable().optional(), avatar_url: z.string().nullable().optional(),
  comment: z.string(), created_at: z.iso.datetime({ offset: true }),
  contexts: z.array(z.enum(contexts.map(item => item.value))),
  moods: z.array(z.enum(moods.map(item => item.value))),
  energy: z.number().int().min(1).max(5), language: z.enum(["instrumental", "es", "en", "other"]),
  likes: z.number().int().nonnegative(), has_voted: z.boolean(),
});
export type Review = z.infer<typeof reviewSchema>;
export type ReviewsPage = { reviews: Review[]; total: number; nextOffset: number | null };
export type MutationResult<T> = { ok: true; data: T } | { ok: false; code: "INVALID_INPUT" | "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "UNAVAILABLE"; message: string };
export const voteInput = z.object({ recommendationId: z.uuid(), voted: z.boolean() }).strict();
export const savedInput = z.object({ albumId: z.uuid(), saved: z.boolean() }).strict();
export const reportInput = z.object({ recommendationId: z.uuid(), reason: z.string().trim().min(5).max(500) }).strict();
export const reviewsInput = z.object({ albumId: z.uuid(), offset: z.number().int().min(0).max(1_000_000).default(0) }).strict();

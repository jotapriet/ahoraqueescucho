import { z } from "zod";
import { contributionSchema } from "./schema";

export const recommendationChanges = contributionSchema.omit({ album: true });
export const editRecommendationInput = recommendationChanges.extend({ recommendationId: z.uuid() }).strict();
export const withdrawRecommendationInput = z.object({ recommendationId: z.uuid() }).strict();
export type RecommendationChanges = z.infer<typeof recommendationChanges>;
export type ManageResult = { ok: true } | { ok: false; message: string };

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reviewSchema, type ReviewsPage } from "./schema";

export async function getReviews(albumId: string, offset = 0): Promise<ReviewsPage> {
  const supabase = await createClient();
  const { data, error, count } = await supabase.from("recommendation_details")
    .select("*", { count: "exact" }).eq("album_id", albumId)
    .order("likes", { ascending: false }).order("created_at", { ascending: false }).order("id")
    .range(offset, offset + 11);
  if (error) throw new Error("Reviews unavailable");
  const reviews = reviewSchema.array().parse(data);
  const total = count ?? reviews.length;
  return { reviews, total, nextOffset: offset + reviews.length < total ? offset + reviews.length : null };
}

import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reviewSchema } from "./schema";

export const getSharedAlbum = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) return null;
  const client = await createClient();
  const { data, error } = await client.from("albums").select("id,title,artists,cover_url").eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar el álbum.");
  return data as { id: string; title: string; artists: string[]; cover_url: string | null } | null;
});
export const getSharedReview = cache(async (albumId: string, reviewId: unknown) => {
  if (!z.uuid().safeParse(reviewId).success) return null;
  const client = await createClient();
  const { data, error } = await client.from("recommendation_details").select("*").eq("album_id", albumId).eq("id", reviewId as string).maybeSingle();
  if (error) throw new Error("No se pudo cargar la reseña compartida.");
  return data ? reviewSchema.parse(data) : null;
});

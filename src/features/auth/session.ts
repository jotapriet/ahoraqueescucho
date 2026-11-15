import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Viewer = { id: string; displayName: string; nick?: string | null };
export const getAuthState = cache(async (): Promise<{ available: boolean; viewer: Viewer | null }> => {
  await connection();
  const available = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  if (!available) return { available, viewer: null };
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { available, viewer: null };
    const profile = await supabase.from("profiles").select("display_name,nick").eq("id", user.id).maybeSingle();
    const name = typeof profile.data?.display_name === "string" ? profile.data.display_name.trim().slice(0, 60) : "Curador";
    return { available, viewer: { id: user.id, displayName: name || "Curador", nick: typeof profile.data?.nick === "string" ? profile.data.nick : null } };
  } catch { return { available, viewer: null }; }
});

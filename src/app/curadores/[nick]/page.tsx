import { CollectionList } from "@/components/collections/collection-list";
import { collectionPage } from "@/features/collections/queries";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nickPattern } from "@/features/profile/identity";
import { Avatar } from "@/components/profile/avatar";
import { Contributions } from "@/components/profile/contributions";

export const metadata = { title: "Perfil de curador · Ahora qué escucho" };
export default async function CuratorPage({ params, searchParams }: { params: Promise<{ nick: string }>; searchParams: Promise<{ aportaciones?: string; colecciones?: string }> }) {
  const { nick } = await params;
  if (!nickPattern.test(nick)) notFound();
  const query = await searchParams;
  const value = Number(query.aportaciones);
  const page = Number.isSafeInteger(value) && value > 0 && value <= 10000 ? value : 1;
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("id,nick,avatar_url").eq("nick", nick).maybeSingle();
  if (error) throw new Error("No se pudo cargar el perfil. Vuelve a intentarlo.");
  if (!profile) notFound();
  // Esta ruta pública nunca consulta saved_albums ni recibe su contenido.
  return <main id="main-content" className="site-container py-10"><Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Volver a descubrir</Link><div className="mt-9 flex items-center gap-4"><Avatar userId={profile.id} url={profile.avatar_url} nick={nick} /><div><p className="eyebrow mb-2">UNA PERSONA, SU SELECCIÓN</p><h1 className="break-all text-4xl">@{nick}</h1></div></div><p className="mt-5 text-sm text-muted-foreground">Discos que merecen una escucha, recomendados por @{nick}.</p><CollectionList userId={profile.id} page={collectionPage(query.colecciones)} basePath={`/curadores/${nick}`} /><Contributions userId={profile.id} page={page} basePath={`/curadores/${nick}`} /></main>;
}

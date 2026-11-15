import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthState } from "@/features/auth/session";
import { loginHref } from "@/features/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { CollectionEditor } from "@/components/collections/collection-editor";
export const metadata = { title: "Crear colección · Ahora qué escucho" };
export default async function NewCollectionPage() {
  const { viewer } = await getAuthState();
  if (!viewer) redirect(loginHref("/colecciones/nueva"));
  const client = await createClient();
  const { data, error } = await client.from("profiles").select("nick").eq("id", viewer.id).single();
  if (error) throw new Error("No se pudo cargar tu identidad de curador.");
  if (!data.nick) redirect("/perfil?next=%2Fcolecciones%2Fnueva");
  return <main id="main-content" className="site-container py-10"><div className="mx-auto max-w-3xl"><p className="eyebrow mb-3">UNA SELECCIÓN CON TU FIRMA</p><h1 className="text-4xl">¿Qué une a estos discos?</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Dales un título, cuenta su historia y prepara el recorrido. Sin prisas, sin algoritmos.</p><CollectionEditor initial={{ id: randomUUID(), title: "", introduction: "", albums: [] }} /></div></main>;
}

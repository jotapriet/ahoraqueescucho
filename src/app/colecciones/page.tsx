import Link from "next/link";
import { CollectionList } from "@/components/collections/collection-list";
import { Button } from "@/components/ui/button";
import { collectionPage } from "@/features/collections/queries";
export const metadata = { title: "Colecciones de curadores · Ahora qué escucho" };
export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  return <main id="main-content" className="site-container py-12"><p className="eyebrow mb-3">LA ESTANTERÍA COMPARTIDA</p><h1 className="max-w-3xl text-4xl sm:text-5xl">Un puñado de discos.<br />Una historia que los une.</h1><p className="my-6 max-w-xl text-sm leading-relaxed text-muted-foreground">Tardes de lluvia, viajes sin prisa, domingos de cocina. Pequeñas selecciones hechas por personas, para escuchar álbumes completos a tu ritmo.</p><Button asChild><Link href="/colecciones/nueva">Crear mi colección</Link></Button><CollectionList page={collectionPage(page)} basePath="/colecciones" /></main>;
}

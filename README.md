# Ahora qué escucho

Curaduría musical humana para descubrir álbumes completos según tu contexto, estado de ánimo y energía. Una experiencia cálida inspirada en las tiendas de vinilos independientes, con modos claro y oscuro.

[Visitar la aplicación](https://ahoraqueescucho.vercel.app)

## Funcionalidades

- Descubrimiento por contexto, energía, ánimo e idioma, y recomendaciones por sorpresa.
- Búsqueda de álbumes en Deezer y MusicBrainz; Spotify opcional. Enlaces de escucha multiplataforma mediante Odesli.
- Reseñas de curadores, votos «Acertado» y reporte de etiquetas.
- Publicación, edición y retirada de las recomendaciones propias.
- Perfiles con nick inmutable, foto editable y aportaciones públicas.
- Pendientes e historial de escuchas privados, con fecha y nota personal.
- Colecciones temáticas públicas, ordenables y compartibles.
- Enlaces a reseñas concretas y tarjetas Open Graph dinámicas.
- Acceso por enlace de correo y proveedores Google/Apple cuando se habilitan en Supabase.

## Stack

Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS, componentes shadcn/ui, lucide-react y Supabase (PostgreSQL, Auth y Storage).

## Desarrollo local

Requisitos: Node.js 20.19 o superior y pnpm compatible con el archivo de bloqueo.

1. Ejecuta `pnpm install --frozen-lockfile`.
2. Copia `.env.example` a `.env.local` y configura tu propio proyecto Supabase.
3. Aplica las migraciones siguiendo [la guía de Supabase](supabase/DEPLOYMENT.md).
4. Ejecuta `pnpm dev`.

En Windows también puedes usar `iniciar-local.cmd` o `iniciar-local.ps1`.

## Variables de entorno

`.env.example` contiene únicamente nombres y valores vacíos. Usa `NEXT_PUBLIC_SUPABASE_URL` y una clave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`). La publicación verificada de álbumes requiere `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`, solo en el servidor.

`APP_URL` debe ser el origen público de la aplicación en producción. Los proveedores de acceso se configuran en Supabase; sus secretos OAuth no se incorporan al código. Spotify y Odesli admiten las credenciales opcionales indicadas en el ejemplo.

No publiques archivos `.env`, claves, tokens ni datos de usuarios. Los pendientes y las notas personales están protegidos mediante RLS y no se incluyen en perfiles públicos.

## Comprobaciones

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

La suite cubre validación, Server Actions, autenticación, RLS, votos, publicación, perfiles, bibliotecas privadas y colecciones. Las pruebas de base de datos usan PGlite con datos ficticios.

## Despliegue

Consulta [la guía de Vercel](docs/despliegue-vercel.md). El repositorio incluye `vercel.json` y un archivo de exclusiones para evitar subir secretos y artefactos locales.

[Fuentes y límites de las APIs musicales](docs/music-apis.md).

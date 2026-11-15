# Preparar Supabase

Crea tu propio proyecto Supabase y aplica los archivos de `supabase/migrations` en orden lexicográfico:

1. 202611120001_initial_schema.sql
2. 202611130001_recommendation_results.sql
3. 202611130002_publish_recommendation.sql
4. 202611130003_curator_profiles.sql
5. 202611130004_random_inspiration.sql
6. 202611130005_musicbrainz_catalog.sql
7. 202611140001_listening_history.sql
8. 202611140002_surprise_recommendations.sql
9. 202611140003_curator_collections.sql

Los archivos de despliegue agregados son alternativas para instalaciones manuales y registran las migraciones en el historial. No ejecutes tanto una migración como su bloque agregado sobre la misma base: no están pensados para repetirse. No vuelvas a ejecutar deployment.sql sobre una base inicializada.

Las migraciones crean las tablas, índices, políticas RLS, funciones y bucket de avatares. Los datos de Auth, fotos, reseñas, pendientes e historiales reales no forman parte del repositorio. Los datos de pruebas son ficticios.

Configura tu URL y clave pública en .env.local. Para la publicación de álbumes, configura una clave privada exclusivamente en servidor. Nunca la incluyas en Git ni en variables NEXT_PUBLIC_.

Configura Site URL y Redirect URLs en Supabase Auth. Los accesos por correo requieren una plantilla Magic Link y configuración de entrega apropiada. Para Google/Apple, habilita el proveedor y configura sus credenciales directamente en Supabase. Consulta también [la guía de despliegue](../docs/despliegue-vercel.md).

Antes de publicar, verifica que pendientes e historiales son privados, que las mutaciones requieren autenticación y que cada usuario solo puede modificar sus aportaciones y colecciones. La suite de pruebas comprueba estas restricciones con PGlite.

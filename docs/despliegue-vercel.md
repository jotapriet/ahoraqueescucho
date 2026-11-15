# Despliegue en Vercel

1. Importa este repositorio en tu cuenta de Vercel o ejecuta `vercel link` desde tu copia local.
2. Selecciona el framework Next.js. `vercel.json` define la compilación con webpack.
3. Configura las variables del archivo `.env.example` en el entorno Production, usando tu propio proyecto Supabase. Guarda las claves privadas como secretos y nunca con prefijo NEXT_PUBLIC_.
4. Configura `APP_URL` con el origen HTTPS del dominio que Vercel asigne a tu proyecto.
5. Publica mediante Vercel o `vercel deploy --prod`.

## Supabase Auth

Actualiza Site URL al origen público de la aplicación. Autoriza `https://TU-DOMINIO/auth/callback**` en Redirect URLs para los parámetros de retorno que utiliza la app. Para desarrollo local puedes añadir `http://localhost:3000/auth/callback**` y `http://127.0.0.1:3000/auth/callback**`.

Los proveedores Google y Apple se habilitan en Supabase. En el proveedor externo registra el callback `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Los secretos OAuth se guardan en Supabase.

## Publicación segura

No subas .env.local, .vercel, node_modules ni artefactos generados. Las variables de producción se gestionan en Vercel y no se copian desde GitHub. La integración de Git permite desplegar nuevos commits si se configura en Vercel.

Comprueba portada, búsqueda, login y retorno de autenticación en el dominio publicado. La ruta /dev/resultado debe devolver 404 en producción.

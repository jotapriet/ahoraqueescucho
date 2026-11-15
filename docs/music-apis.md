# Fuentes de metadatos y enlaces de escucha

Consulta: 13 de noviembre de 2026.

## MusicBrainz + Cover Art Archive (integrados)

MusicBrainz es un catálogo comunitario abierto. Su API de lectura no necesita clave y es gratuita para uso no comercial. Permite buscar álbumes y consultar título, artistas, primera fecha, géneros y relaciones de enlaces. Se usa el MBID de release-group para agrupar las ediciones de un mismo álbum. Las portadas proceden de Cover Art Archive; no todos los álbumes tienen imagen.

- Identificación: User-Agent con nombre de la app y contacto público.
- Límite: una petición por segundo; se serializan solicitudes con 1100 ms de separación, cola acotada y caché de búsqueda/detalle/enlaces. El limitador es por proceso: un despliegue con varias réplicas que compartan IP necesita coordinación distribuida antes de ampliar tráfico.
- Datos: el núcleo es CC0; datos suplementarios tienen otra licencia. Se conservan créditos a MusicBrainz/CAA en las fichas de esta fuente. Revisar sus condiciones para nuevos usos.
- Las relaciones de una edición digital solo se aceptan si pertenece al release-group elegido. No se convierten enlaces a pistas individuales en álbumes.

Fuentes oficiales: [API](https://musicbrainz.org/doc/MusicBrainz_API), [FAQ](https://musicbrainz.org/doc/MusicBrainz_API/FAQ), [límites](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting), [licencias](https://musicbrainz.org/doc/About/Data_License), [portadas](https://musicbrainz.org/doc/Cover_Art_Archive/API).

## iTunes Search API (investigada, no integrada)

Otra alternativa sin clave para buscar álbumes y obtener datos y portadas de su tienda. Es un catálogo comercial de Apple, por lo que encaja peor que MusicBrainz con una base de datos abierta. No se ha añadido como tercer proveedor para evitar ampliar identidades y reglas de equivalencia innecesariamente.

[Documentación oficial de Apple](https://performance-partners.apple.com/search-api).

## Plataformas de escucha

Al pulsar un álbum de la colección se abre /albumes/[id]. La ficha combina enlaces guardados y plataforma original con Odesli cuando responde y relaciones verificadas de MusicBrainz como alternativa. En las pruebas sin clave, Odesli respondió HTTP 401; ese fallo no impide mostrar los enlaces conocidos ni usar MusicBrainz.

Solo se muestran plataformas con enlaces directos confirmados. Un bloque separado permite buscar en Spotify, Apple Music, YouTube Music, Bandcamp y Tidal: esas búsquedas no se presentan como prueba de disponibilidad ni se confunden con enlaces al álbum. La disponibilidad regional depende de cada plataforma.

Las consultas se ejecutan en servidor. No se requieren credenciales de Spotify ni de Deezer para usar MusicBrainz. No se publica ninguna recomendación para comprobar las integraciones.

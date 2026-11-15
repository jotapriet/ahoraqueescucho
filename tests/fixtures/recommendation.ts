import type { RecommendationResult } from "../../src/features/recommendations/result";

// Datos exclusivamente ficticios para tests y una vista de desarrollo desactivada por defecto.
export const resultFixture: RecommendationResult = {
  album: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Con Todo El Mundo", artists: ["Khruangbin"], year: 2018, genres: ["Psychedelic soul", "Funk"], vibes: ["bright", "introspective", "nostalgic"], coverUrl: "/images/khruangbin.jpg", links: { spotify: "https://open.spotify.com", appleMusic: "https://music.apple.com", bandcamp: "https://bandcamp.com" } },
  viewerId: "22222222-2222-4222-8222-222222222222", saved: false,
  reviews: { total: 3, nextOffset: null, reviews: [
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", album_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: "11111111-1111-4111-8111-111111111111", display_name: "Clara", created_at: "2026-10-24T10:00:00Z", moods: ["bright", "introspective"], contexts: ["relaxing_home", "active_listening"], energy: 2, language: "instrumental", comment: "Para esa tarde en la que no necesitas ir a ningún sitio. Abre la ventana, deja el móvil lejos y permite que el bajo haga el resto. Se siente como volver a casa por el camino largo.", likes: 27, has_voted: false },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", album_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: "33333333-3333-4333-8333-333333333333", display_name: "Mateo", created_at: "2026-10-20T11:00:00Z", moods: ["nostalgic", "bright"], contexts: ["driving"], energy: 3, language: "instrumental", comment: "Me acompaña cuando la carretera se queda tranquila. Hay algo en esas guitarras que convierte cualquier trayecto conocido en un pequeño viaje.", likes: 14, has_voted: false },
    { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", album_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: "44444444-4444-4444-8444-444444444444", display_name: "Inés", created_at: "2026-10-18T12:00:00Z", moods: ["introspective"], contexts: ["focus_work"], energy: 2, language: "instrumental", comment: "Lo pongo al terminar de trabajar. Un disco que consigue hacer espacio, sin pedirte nada. Mejor sin saltarse ninguna canción.", likes: 6, has_voted: false },
  ] },
};

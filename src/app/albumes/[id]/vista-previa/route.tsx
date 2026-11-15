import { ImageResponse } from "next/og";
import { getSharedAlbum, getSharedReview } from "@/features/recommendations/share-data";
import { safeCoverUrl } from "@/lib/music/urls";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await getSharedAlbum(id);
  if (!album) return new Response("Álbum no encontrado", { status: 404 });
  const review = await getSharedReview(id, new URL(request.url).searchParams.get("resena"));
  const curator = review ? review.nick ? `@${review.nick}` : review.display_name : "Una selección humana";
  let cover: string | null = null;
  const url = safeCoverUrl(album.cover_url ?? undefined);
  if (url) {
    try {
      const signal = AbortSignal.timeout(6000);
      let target = url;
      let response = await fetch(target, { signal, redirect: "manual" });
      // Cover Art Archive sirve las portadas desde Internet Archive. No seguir
      // redirecciones a destinos arbitrarios de metadatos externos.
      for (let hop = 0; response.status >= 300 && response.status < 400 && hop < 3; hop++) {
        const location = response.headers.get("location");
        if (!location) break;
        const next = new URL(location, target);
        if (next.protocol !== "https:" || next.username || next.password || next.port || !(safeCoverUrl(next.href) || next.hostname === "archive.org" || next.hostname.endsWith(".archive.org"))) break;
        target = next.href;
        response = await fetch(target, { signal, redirect: "manual" });
      }
      const type = response.headers.get("content-type")?.split(";")[0];
      if (response.ok && type && ["image/jpeg", "image/png", "image/webp"].includes(type)) {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength <= 5_000_000) cover = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
      }
    } catch { /* La tarjeta sigue funcionando sin portada. */ }
  }
  return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#F7F4EF", color: "#2C2825", padding: 48, flexDirection: "column", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E2DDD5", paddingBottom: 24, fontSize: 22, color: "#C86D51" }}><span>ahora qué escucho.</span><span>CURADURÍA HUMANA · ÁLBUMES COMPLETOS</span></div>
    <div style={{ display: "flex", gap: 42, alignItems: "center", flex: 1 }}>
      <div style={{ display: "flex", position: "relative", width: 330, height: 330, flexShrink: 0 }}><div style={{ display: "flex", position: "absolute", top: 12, left: 45, width: 306, height: 306, borderRadius: "50%", background: "#24211F" }} /><div style={{ display: "flex", width: 306, height: 306, borderRadius: 8, background: "#EFECE6", overflow: "hidden", alignItems: "center", justifyContent: "center", fontSize: 100 }}>{cover ? <img src={cover} width={306} height={306} style={{ objectFit: "cover" }} /> : "♫"}</div></div>
      <div style={{ display: "flex", flexDirection: "column", width: 680 }}><div style={{ display: "flex", color: "#6B8E78", fontSize: 22, marginBottom: 14 }}>{curator.slice(0, 55)}</div><div style={{ display: "flex", fontSize: 36, fontWeight: 700, lineHeight: 1.15 }}>{album.title.length > 80 ? `${album.title.slice(0, 77)}…` : album.title}</div><div style={{ display: "flex", fontSize: 22, color: "#78716C", marginTop: 10 }}>{album.artists.join(", ").slice(0, 90)}</div><div style={{ display: "flex", marginTop: 24, fontSize: 22, lineHeight: 1.4 }}>{review ? `«${review.comment}»` : "Dale tiempo a un disco entero. De la primera a la última pista."}</div></div>
    </div><div style={{ display: "flex", fontSize: 18, color: "#78716C" }}>Menos algoritmo. Más piel de gallina.</div>
  </div>, { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } });
}

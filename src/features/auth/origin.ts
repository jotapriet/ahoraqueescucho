import "server-only";
import { headers } from "next/headers";

export async function getAuthOrigin(): Promise<string> {
  const configured = process.env.APP_URL;
  if (configured) {
    const url = new URL(configured);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error("Invalid application origin");
    return url.origin;
  }
  // En desarrollo, conservar host/puerto del navegador evita perder la cookie PKCE.
  if (process.env.NODE_ENV !== "production") {
    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const url = new URL(origin);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.origin;
  }
  throw new Error("Configure APP_URL for authentication");
}

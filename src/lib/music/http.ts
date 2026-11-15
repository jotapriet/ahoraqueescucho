import "server-only";
import { MusicError } from "./errors";

// Solo se llama con endpoints constantes de proveedor, jamás con URLs del usuario.
export async function fetchJson(url: string | URL, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new MusicError("UNAVAILABLE", "No se pudo conectar con el proveedor musical.");
  }
  if (response.status === 429) {
    const header = response.headers.get("retry-after");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : 60;
    throw new MusicError("RATE_LIMITED", "El proveedor ha limitado las consultas. Espera antes de reintentar.", Math.min(seconds, 3600));
  }
  if (response.status === 404) throw new MusicError("NOT_FOUND", "No se ha encontrado el álbum.");
  if (response.status === 401 || response.status === 403) {
    throw new MusicError("CONFIGURATION", "El proveedor ha rechazado el acceso. Revisa las credenciales y los permisos de su API.");
  }
  if (!response.ok) throw new MusicError("UNAVAILABLE", "El proveedor musical no está disponible.");
  try {
    return await response.json();
  } catch {
    throw new MusicError("INVALID_RESPONSE", "El proveedor devolvió una respuesta no válida.");
  }
}

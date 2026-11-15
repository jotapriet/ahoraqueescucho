const destinations = new Set(["/", "/aportar", "/descubrir", "/perfil", "/colecciones", "/colecciones/nueva"]);

// Solo rutas internas conocidas; conserva filtros y descartes sin permitir redirecciones externas.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/aportar";
  try {
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || !destinations.has(url.pathname) && !/^\/(?:albumes|colecciones)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\/editar)?$/.test(url.pathname)) return "/aportar";
    return url.pathname + url.search + url.hash;
  } catch { return "/aportar"; }
}

export function loginHref(returnTo: string) {
  return `/login?${new URLSearchParams({ next: safeReturnTo(returnTo) })}`;
}

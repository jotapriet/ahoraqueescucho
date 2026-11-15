export const nickPattern = /^[a-z0-9_]{3,24}$/;
export const avatarLimit = 768 * 1024;

export function safeAvatarUrl(value: string | null | undefined, userId: string): string | null {
  try {
    const url = new URL(value ?? "");
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    return url.origin === origin && !url.username && !url.password && !url.search && !url.hash
      && new RegExp(`^/storage/v1/object/public/avatars/${userId}/[a-f0-9-]+\\.(jpg|png|webp)$`).test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export function imageFormat(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", mime: "image/jpeg" };
  if ([137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) return { extension: "png", mime: "image/png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return { extension: "webp", mime: "image/webp" };
  return null;
}

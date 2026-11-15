import { safeAvatarUrl } from "@/features/profile/identity";

export function Avatar({ userId, url, nick }: { userId: string; url?: string | null; nick: string }) {
  const safe = safeAvatarUrl(url, userId);
  return safe ? <img src={safe} alt={`Foto de @${nick}`} width={64} height={64} className="size-14 shrink-0 rounded-full border object-cover" referrerPolicy="no-referrer" /> : <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-serif text-2xl text-primary" aria-hidden="true">{nick.slice(0, 1).toUpperCase()}</span>;
}

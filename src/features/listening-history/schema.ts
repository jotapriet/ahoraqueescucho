import { z } from "zod";

export function todayInMadrid(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export const listeningInput = z.object({
  albumId: z.uuid(),
  listenedOn: z.iso.date().refine(value => value >= "1900-01-01" && value <= todayInMadrid()),
  note: z.string().trim().refine(value => [...value].length <= 1000).default(""),
}).strict();

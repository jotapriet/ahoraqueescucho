export const contexts = [
  { value: "active_listening", label: "Solo yo y la música", detail: "Escucha activa", icon: "headphones" },
  { value: "focus_work", label: "En mi zona", detail: "Concentración / trabajo", icon: "coffee" },
  { value: "driving", label: "Kilómetros por delante", detail: "Conduciendo", icon: "car" },
  { value: "party", label: "Que empiece la noche", detail: "Fiesta / previa", icon: "wine" },
  { value: "relaxing_home", label: "Sin ninguna prisa", detail: "Relajándome en casa", icon: "armchair" },
] as const;
export const moods = [
  { value: "melancholic", label: "Melancólico", icon: "cloud" },
  { value: "euphoric", label: "Eufórico", icon: "sparkles" },
  { value: "introspective", label: "Introspectivo", icon: "orbit" },
  { value: "dark", label: "Oscuro", icon: "moon" },
  { value: "bright", label: "Luminoso", icon: "sun" },
  { value: "nostalgic", label: "Nostálgico", icon: "history" },
] as const;
export const languages = [
  { value: "any", label: "Cualquier idioma" }, { value: "instrumental", label: "Instrumental" },
  { value: "es", label: "Español" }, { value: "en", label: "Inglés" }, { value: "other", label: "Otros" },
] as const;
export type DiscoveryFilters = {
  context: (typeof contexts)[number]["value"];
  energy: number;
  moods: Array<(typeof moods)[number]["value"]>;
  language: (typeof languages)[number]["value"];
};
export type SearchParams = Record<string, string | string[] | undefined>;
export function parseDiscoveryFilters(params: SearchParams): DiscoveryFilters {
  const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const context = contexts.find(item => item.value === scalar(params.context))?.value ?? "relaxing_home";
  const energyValue = Number(scalar(params.energy) ?? 2);
  const selected = params.mood === undefined ? ["introspective"] : Array.isArray(params.mood) ? params.mood : [params.mood];
  return {
    context,
    energy: Number.isInteger(energyValue) && energyValue >= 1 && energyValue <= 5 ? energyValue : 2,
    moods: moods.filter(item => selected.includes(item.value)).map(item => item.value),
    language: languages.find(item => item.value === scalar(params.language))?.value ?? "any",
  };
}
export function discoverySearchParams(filters: DiscoveryFilters) {
  const params = new URLSearchParams({ context: filters.context, energy: String(filters.energy) });
  for (const mood of filters.moods) params.append("mood", mood);
  if (!filters.moods.length) params.set("mood", "");
  if (filters.language !== "any") params.set("language", filters.language);
  return params;
}

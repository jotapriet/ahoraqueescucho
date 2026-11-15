import { describe, expect, it } from "vitest";
import { discoverySearchParams, parseDiscoveryFilters } from "../src/features/discovery/filters";

describe("filtros compartibles", () => {
  it("restaura moods múltiples y conserva los filtros tras editar", () => {
    const filters = parseDiscoveryFilters({ context: "driving", energy: "4", mood: ["euphoric", "bright"], language: "es" });
    const params = discoverySearchParams(filters);
    expect(params.getAll("mood")).toEqual(["euphoric", "bright"]);
    expect(parseDiscoveryFilters({ context: params.get("context")!, energy: params.get("energy")!, mood: params.getAll("mood"), language: params.get("language")! })).toEqual(filters);
  });
  it("mantiene una selección de moods vacía en lugar de activar el mood por defecto", () => {
    const filters = parseDiscoveryFilters({ mood: "" });
    expect(filters.moods).toEqual([]);
    expect(discoverySearchParams(filters).get("mood")).toBe("");
  });
  it("descarta valores desconocidos y energía fuera de rango o decimal", () => {
    for (const energy of ["-1", "6", "NaN", "2.5"]) {
      expect(parseDiscoveryFilters({ context: "unknown", energy, mood: ["bright", "unknown", "bright"], language: "invalid" })).toMatchObject({ context: "relaxing_home", energy: 2, moods: ["bright"], language: "any" });
    }
  });
});

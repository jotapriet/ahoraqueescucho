// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ edit: vi.fn(), withdraw: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("../src/features/contributions/manage-actions", () => ({ editRecommendationAction: m.edit, withdrawRecommendationAction: m.withdraw }));
import { RecommendationEditor } from "../src/components/contributions/recommendation-editor";
const initial = { contexts: ["relaxing_home"] as const, moods: ["bright"] as const, energy: 2, language: "es" as const, comment: "Original" };
beforeEach(() => vi.resetAllMocks()); afterEach(cleanup);
function show() { render(<RecommendationEditor recommendationId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" initial={{ ...initial, contexts: [...initial.contexts], moods: [...initial.moods] }} />); }
it("abre bajo demanda y conserva la edición si falla el guardado", async () => {
  show(); expect(screen.queryByLabelText(/Comentario/)).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Gestionar mi aportación" }));
  fireEvent.change(screen.getByLabelText(/Comentario/), { target: { value: "Corregido" } });
  m.edit.mockResolvedValue({ ok: false, message: "No se pudo guardar." });
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("No se pudo guardar.")).toBeTruthy();
  expect((screen.getByLabelText(/Comentario/) as HTMLTextAreaElement).value).toBe("Corregido"); expect(m.refresh).not.toHaveBeenCalled();
  m.edit.mockResolvedValue({ ok: true }); await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(m.refresh).toHaveBeenCalledOnce());
});
it("exige confirmación explícita antes de retirar y permite cancelar", async () => {
  show(); await userEvent.click(screen.getByRole("button", { name: "Gestionar mi aportación" }));
  await userEvent.click(screen.getByRole("button", { name: "Retirar mi aportación" })); expect(m.withdraw).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar retirada" })); expect(m.withdraw).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Retirar mi aportación" })); m.withdraw.mockResolvedValue({ ok: true });
  await userEvent.click(screen.getByRole("button", { name: "Sí, retirar aportación" })); await waitFor(() => expect(m.refresh).toHaveBeenCalledOnce());
});

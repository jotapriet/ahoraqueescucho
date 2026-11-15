// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../src/features/recommendations/actions", () => ({ setSavedAlbumAction: mocks.save }));
import { RemoveSaved } from "../src/components/profile/remove-saved";
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("actualiza la lista únicamente después de confirmar la retirada", async () => {
  mocks.save.mockResolvedValue({ ok: true, data: { saved: false } });
  render(<RemoveSaved albumId="album" title="Un disco" />);
  await userEvent.click(screen.getByRole("button", { name: "Quitar Un disco de pendientes" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(mocks.save).toHaveBeenCalledWith({ albumId: "album", saved: false });
});
it("conserva el disco y permite reintentar si la retirada falla", async () => {
  mocks.save.mockResolvedValue({ ok: false, message: "No se pudo guardar el cambio." });
  render(<RemoveSaved albumId="album" title="Un disco" />);
  await userEvent.click(screen.getByRole("button", { name: "Quitar Un disco de pendientes" }));
  expect(await screen.findByText("No se pudo guardar el cambio.")).toBeTruthy();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
});

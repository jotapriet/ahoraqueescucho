// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pick: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../src/features/discovery/surprise", () => ({ getSurpriseAlbumAction: mocks.pick }));
import { SurprisePicker } from "../src/components/discovery/surprise-picker";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("ofrece una sorpresa pública sin controles de historial ni filtros de Vibes", async () => {
  mocks.pick.mockResolvedValue({ ok: true, albumId: id });
  render(<SurprisePicker signedIn={false} />);
  expect(screen.queryByRole("checkbox")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Sorpréndeme" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/albumes/${id}?sorpresa=1&sinEscuchados=0`));
  expect(mocks.pick).toHaveBeenCalledWith({ excludeListened: false });
});
it("permite desactivar la exclusión al agotarse los discos sin perder el control del usuario", async () => {
  mocks.pick.mockResolvedValueOnce({ ok: false, code: "EMPTY", message: "No quedan discos sin escuchar." });
  render(<SurprisePicker signedIn />);
  const checkbox = screen.getByRole("checkbox", { name: "Excluir los que ya he escuchado" }) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Sorpréndeme" }));
  expect(await screen.findByText("No quedan discos sin escuchar.")).toBeTruthy();
  expect(checkbox.checked).toBe(true); expect(mocks.push).not.toHaveBeenCalled();
  await userEvent.click(checkbox);
  mocks.pick.mockResolvedValue({ ok: true, albumId: id });
  await userEvent.click(screen.getByRole("button", { name: "Sorpréndeme" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/albumes/${id}?sorpresa=1&sinEscuchados=0`));
  expect(mocks.pick).toHaveBeenLastCalledWith({ excludeListened: false });
});

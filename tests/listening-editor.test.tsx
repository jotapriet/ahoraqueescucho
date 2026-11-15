// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mark: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../src/features/listening-history/actions", () => ({ markListenedAction: mocks.mark, updateListeningAction: mocks.update }));
import { ListeningEditor } from "../src/components/profile/listening-editor";
const albumId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("mueve el disco con su fecha y nota y actualiza las listas solo al confirmarse", async () => {
  mocks.mark.mockResolvedValue({ ok: true, data: { listened: true } });
  render(<ListeningEditor albumId={albumId} title="Un disco" />);
  await userEvent.click(screen.getByRole("button", { name: "Ya he escuchado Un disco" }));
  fireEvent.change(screen.getByLabelText("Fecha de escucha"), { target: { value: "2026-01-01" } });
  await userEvent.type(screen.getByLabelText(/Nota personal/), "Me ha acompañado toda la tarde.");
  await userEvent.click(screen.getByRole("button", { name: "Guardar escucha" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(mocks.mark).toHaveBeenCalledWith({ albumId, listenedOn: "2026-01-01", note: "Me ha acompañado toda la tarde." });
});
it("conserva fecha y nota si falla el guardado para poder reintentar", async () => {
  mocks.mark.mockResolvedValue({ ok: false, message: "No se pudo guardar." });
  render(<ListeningEditor albumId={albumId} title="Un disco" />);
  await userEvent.click(screen.getByRole("button", { name: "Ya he escuchado Un disco" }));
  fireEvent.change(screen.getByLabelText("Fecha de escucha"), { target: { value: "2026-01-01" } });
  await userEvent.type(screen.getByLabelText(/Nota personal/), "Mi nota privada.");
  await userEvent.click(screen.getByRole("button", { name: "Guardar escucha" }));
  expect(await screen.findByText("No se pudo guardar.")).toBeTruthy();
  expect((screen.getByLabelText(/Nota personal/) as HTMLTextAreaElement).value).toBe("Mi nota privada.");
  expect((screen.getByLabelText("Fecha de escucha") as HTMLInputElement).value).toBe("2026-01-01");
  expect(mocks.refresh).not.toHaveBeenCalled();
});

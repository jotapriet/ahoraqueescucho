// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), save: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("../src/features/collections/actions", () => ({ searchCollectionAlbumsAction: mocks.search, saveCollectionAction: mocks.save }));
import { CollectionEditor } from "../src/components/collections/collection-editor";
const a = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Primero", artists: ["Artista"], cover_url: null };
const b = { ...a, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Segundo" };
beforeEach(() => { vi.resetAllMocks(); mocks.search.mockResolvedValue({ ok: true, albums: [a, b] }); });
afterEach(cleanup);
it("añade sin repetir, reordena y conserva el borrador y su ID si falla la publicación", async () => {
  mocks.save.mockResolvedValue({ ok: false, message: "No se pudo publicar." });
  render(<CollectionEditor initial={{ id: a.id, title: "Día de lluvia", introduction: "Una escucha completa.", albums: [] }} />);
  await userEvent.click(await screen.findByRole("button", { name: "Añadir Primero" }));
  await userEvent.click(screen.getByRole("button", { name: "Añadir Segundo" }));
  expect((screen.getByRole("button", { name: "Primero añadido" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Subir Segundo" }));
  await userEvent.click(screen.getByRole("button", { name: "Publicar colección" }));
  expect(await screen.findByText("No se pudo publicar.")).toBeTruthy();
  expect(mocks.save).toHaveBeenCalledWith({ id: a.id, title: "Día de lluvia", introduction: "Una escucha completa.", albumIds: [b.id, a.id] });
  mocks.save.mockResolvedValue({ ok: true, id: a.id });
  await userEvent.click(screen.getByRole("button", { name: "Publicar colección" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/colecciones/${a.id}`));
});
it("ignora búsquedas antiguas que llegan después de una nueva", async () => {
  let resolve!: (value: unknown) => void;
  mocks.search.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValue({ ok: true, albums: [b] });
  render(<CollectionEditor initial={{ id: a.id, title: "", introduction: "", albums: [] }} />);
  await waitFor(() => expect(mocks.search).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Segundo" } });
  expect(await screen.findByRole("button", { name: "Añadir Segundo" })).toBeTruthy();
  resolve({ ok: true, albums: [a] });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Añadir Primero" })).toBeNull());
});

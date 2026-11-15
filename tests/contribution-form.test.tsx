// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), album: vi.fn(), publish: vi.fn() }));
vi.mock("../src/features/music/actions", () => ({ searchAlbumsAction: mocks.search, getAlbumAction: mocks.album }));
vi.mock("../src/features/contributions/actions", () => ({ publishRecommendationAction: mocks.publish }));
vi.mock("../src/components/auth/email-access", () => ({ EmailAccess: () => <div>Acceso por correo</div> }));
import { ContributionForm } from "../src/components/contributions/contribution-form";

const album = { provider: "deezer", id: "123", title: "Un álbum de prueba", artists: ["Artista"], releaseYear: 2020, genres: [], coverUrl: null, sourceUrl: "https://www.deezer.com/album/123" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.search.mockResolvedValue({ ok: true, data: [album] });
  mocks.album.mockResolvedValue({ ok: true, data: album });
});
afterEach(() => cleanup());
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("searchbox", { name: "Buscar álbum o artista" }), "Artista");
  await user.click(await screen.findByRole("button", { name: /Un álbum de prueba/ }));
  await screen.findByRole("button", { name: "Cambiar álbum" });
  await user.click(screen.getByRole("button", { name: "Introspectivo" }));
  await user.selectOptions(screen.getByLabelText("Idioma del álbum"), "instrumental");
  await user.type(screen.getByRole("textbox", { name: "Tu recomendación" }), "Para una tarde tranquila.");
}
describe("formulario para aportar discos", () => {
  it("busca, selecciona, etiqueta y publica sin enviar metadatos ni identidad del cliente", async () => {
    const user = userEvent.setup();
    render(<ContributionForm provider="deezer" signedIn authAvailable publishingAvailable />);
    mocks.publish.mockResolvedValueOnce({ ok: true, data: { created: true, linksPending: false, albumId: "a", recommendationId: "r" } });
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Aportar a la colección" }));
    expect(await screen.findByText("Tu disco ya tiene su sitio.")).toBeTruthy();
    expect(mocks.publish).toHaveBeenCalledWith({ album: { provider: "deezer", id: "123" }, contexts: ["active_listening"], energy: 2, moods: ["introspective"], language: "instrumental", comment: "Para una tarde tranquila." });
  });
  it("mantiene el texto y el álbum cuando falla la publicación", async () => {
    const user = userEvent.setup(); render(<ContributionForm provider="deezer" signedIn authAvailable publishingAvailable />);
    mocks.publish.mockResolvedValueOnce({ ok: false, code: "UNAVAILABLE", message: "Vuelve a intentarlo." });
    await fill(user); await user.click(screen.getByRole("button", { name: "Aportar a la colección" }));
    expect(await screen.findByText("Vuelve a intentarlo.")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Tu recomendación" }) as HTMLTextAreaElement).value).toBe("Para una tarde tranquila.");
    expect(screen.getByRole("button", { name: "Cambiar álbum" })).toBeTruthy();
  });
  it("no permite publicar como visitante y explica que necesita iniciar sesión", () => {
    render(<ContributionForm provider="deezer" signedIn={false} authAvailable publishingAvailable />);
    expect((screen.getByRole("button", { name: "Aportar a la colección" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Acceso por correo")).toBeTruthy(); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("descarta respuestas antiguas al cambiar de búsqueda", async () => {
    const user = userEvent.setup(); render(<ContributionForm provider="deezer" signedIn authAvailable publishingAvailable />);
    let finishOld!: (value: unknown) => void;
    mocks.search.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
    mocks.search.mockResolvedValueOnce({ ok: true, data: [{ ...album, id: "456", title: "Resultado nuevo" }] });
    const input = screen.getByRole("searchbox", { name: "Buscar álbum o artista" });
    await user.type(input, "Anterior"); await waitFor(() => expect(mocks.search).toHaveBeenCalledTimes(1));
    await user.clear(input); await user.type(input, "Nuevo"); await screen.findByRole("button", { name: /Resultado nuevo/ });
    finishOld({ ok: true, data: [album] });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Un álbum de prueba/ })).toBeNull());
  });
});

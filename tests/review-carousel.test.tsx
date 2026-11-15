// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({ setVoteAction: vi.fn(), getReviewsAction: vi.fn(), reportRecommendationAction: vi.fn() }));
vi.mock("../src/features/recommendations/actions", () => actions);
import { ReviewCarousel } from "../src/components/recommendations/review-carousel";
import { resultFixture } from "./fixtures/recommendation";

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const props = { albumId: resultFixture.album.id, initialPage: resultFixture.reviews, viewerId: resultFixture.viewerId };
describe("carrusel e interacción de votos", () => {
  it("navega entre reseñas sin mezclar etiquetas, identidad ni comentario", async () => {
    const user = userEvent.setup(); render(<ReviewCarousel {...props} />);
    expect(screen.getByText("Clara")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reseña siguiente" }));
    expect(screen.getByText("Mateo")).toBeTruthy();
    expect(screen.getByText("Conduciendo")).toBeTruthy();
    expect(screen.queryByText("Clara")).toBeNull();
    await user.keyboard("{ArrowLeft}"); expect(screen.getByText("Clara")).toBeTruthy();
  });
  it("aplica el contador confirmado y permite retirar el voto sin cambiar de reseña", async () => {
    const user = userEvent.setup(); render(<ReviewCarousel {...props} />);
    actions.setVoteAction.mockResolvedValueOnce({ ok: true, data: { likes: 28, has_voted: true } });
    await user.click(screen.getByRole("button", { name: "Acertado: 27 votos" }));
    expect(await screen.findByRole("button", { name: "Retirar Acertado: 28 votos" })).toBeTruthy();
    expect(screen.getByText("Clara")).toBeTruthy();
    actions.setVoteAction.mockResolvedValueOnce({ ok: true, data: { likes: 27, has_voted: false } });
    await user.click(screen.getByRole("button", { name: "Retirar Acertado: 28 votos" }));
    expect(await screen.findByRole("button", { name: "Acertado: 27 votos" })).toBeTruthy();
  });
  it("conserva el contador si falla y bloquea peticiones mientras espera", async () => {
    const user = userEvent.setup(); render(<ReviewCarousel {...props} />);
    let finish!: (value: unknown) => void;
    actions.setVoteAction.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const button = screen.getByRole("button", { name: "Acertado: 27 votos" });
    await user.click(button); expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(button); expect(actions.setVoteAction).toHaveBeenCalledTimes(1);
    finish({ ok: false, code: "UNAVAILABLE", message: "No se pudo guardar." });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("No se pudo guardar."));
    expect(screen.getByRole("button", { name: "Acertado: 27 votos" }).getAttribute("aria-pressed")).toBe("false");
  });
  it("no muta para visitantes ni permite votar la reseña propia", async () => {
    const user = userEvent.setup(); const { rerender } = render(<ReviewCarousel {...props} viewerId={null} />);
    await user.click(screen.getByRole("button", { name: "Acertado: 27 votos" }));
    expect(screen.getByRole("status").textContent).toContain("Inicia sesión");
    expect(actions.setVoteAction).not.toHaveBeenCalled();
    rerender(<ReviewCarousel {...props} viewerId={resultFixture.reviews.reviews[0].user_id} />);
    expect((screen.getByRole("button", { name: "Acertado: 27 votos" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("carga la siguiente página de reseñas al llegar al final", async () => {
    const user = userEvent.setup();
    render(<ReviewCarousel {...props} initialPage={{ reviews: [resultFixture.reviews.reviews[0]], total: 2, nextOffset: 1 }} />);
    actions.getReviewsAction.mockResolvedValueOnce({ ok: true, data: { reviews: [resultFixture.reviews.reviews[1]], total: 2, nextOffset: null } });
    await user.click(screen.getByRole("button", { name: "Reseña siguiente" }));
    expect(await screen.findByText("Mateo")).toBeTruthy();
    expect(actions.getReviewsAction).toHaveBeenCalledWith({ albumId: props.albumId, offset: 1 });
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ShareRecommendation } from "../src/components/recommendations/share-recommendation";
afterEach(cleanup);
it("copia la reseña concreta sin incluir filtros ni datos privados de la URL actual", async () => {
  const user = userEvent.setup(); const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<ShareRecommendation albumId="album" reviewId="review" />);
  await user.click(screen.getByRole("button", { name: "Compartir esta reseña" }));
  expect(write).toHaveBeenCalledWith(`${window.location.origin}/albumes/album?resena=review#resena-review`);
  expect(await screen.findByText("Enlace de esta reseña copiado.")).toBeTruthy();
});
it("ofrece un enlace seleccionable si el portapapeles no está disponible", async () => {
  const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  render(<ShareRecommendation albumId="album" reviewId="review" />);
  await user.click(screen.getByRole("button", { name: "Compartir esta reseña" }));
  expect((await screen.findByLabelText("Enlace de la reseña") as HTMLInputElement).value).toContain("?resena=review#resena-review");
});

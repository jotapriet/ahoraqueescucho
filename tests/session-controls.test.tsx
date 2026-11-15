// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ logout: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/descubrir", useSearchParams: () => new URLSearchParams("energy=2&mood=bright"), useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("../src/features/auth/actions", () => ({ signOutAction: mocks.logout }));
import { SessionControls } from "../src/components/auth/session-controls";
beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());
describe("sesión en la cabecera", () => {
  it("ofrece login conservando la pantalla actual", () => {
    render(<SessionControls viewer={null} />);
    const href = screen.getByRole("link", { name: "Entrar" }).getAttribute("href")!;
    expect(new URL(href, "https://local.test").searchParams.get("next")).toBe("/descubrir?energy=2&mood=bright");
  });
  it("cierra la sesión y actualiza la interfaz después de confirmarlo", async () => {
    const user = userEvent.setup(); mocks.logout.mockResolvedValueOnce({ ok: true });
    render(<SessionControls viewer={{ id: "user", displayName: "Curador" }} />);
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("mantiene la sesión visible y permite reintentar si el cierre falla", async () => {
    const user = userEvent.setup(); mocks.logout.mockResolvedValueOnce({ ok: false, message: "Error al salir." });
    render(<SessionControls viewer={{ id: "user", displayName: "Curador" }} />);
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(await screen.findByText("Error al salir.")).toBeTruthy(); expect(mocks.replace).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Cerrar sesión" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

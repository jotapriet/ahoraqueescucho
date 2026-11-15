// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/features/auth/actions", () => ({ requestEmailLinkAction: mocks.request }));
import { EmailAccess } from "../src/components/auth/email-access";
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("explica cómo abrir el enlace sin pedir código y conserva el retorno", async () => {
  mocks.request.mockResolvedValueOnce({ ok: true });
  render(<EmailAccess standalone redirectTo="/perfil" />);
  await userEvent.type(screen.getByLabelText("Correo electrónico"), "test@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Enviar enlace de acceso" }));
  expect(await screen.findByText(/Abre el enlace del mensaje/)).toBeTruthy();
  expect(screen.queryByLabelText("Código de acceso")).toBeNull();
  expect(mocks.request).toHaveBeenCalledWith({ email: "test@example.com", next: "/perfil" });
  expect((screen.getByRole("button", { name: /Reenviar en/ }) as HTMLButtonElement).disabled).toBe(true);
});
it("permite reintentar un envío fallido", async () => {
  mocks.request.mockResolvedValueOnce({ ok: false, message: "No se pudo enviar el enlace." });
  render(<EmailAccess />);
  await userEvent.type(screen.getByLabelText("Correo electrónico"), "test@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Enviar enlace de acceso" }));
  expect(await screen.findByText("No se pudo enviar el enlace.")).toBeTruthy();
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
});

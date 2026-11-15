import "server-only";
import type { ActionResult, MusicErrorCode } from "./types";

export class MusicError extends Error {
  constructor(public readonly code: MusicErrorCode, message: string, public readonly retryAfterSeconds?: number) {
    super(message);
  }
}

export function actionFailure<T>(error: unknown): ActionResult<T> {
  if (error instanceof MusicError) {
    return { ok: false, error: {
      code: error.code, message: error.message,
      ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }),
    } };
  }
  return { ok: false, error: { code: "UNAVAILABLE", message: "El servicio musical no está disponible. Inténtalo más tarde." } };
}

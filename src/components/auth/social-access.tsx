"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signInWithOAuthAction } from "@/features/auth/actions";
import type { OAuthProvider } from "@/features/auth/providers";

export function SocialAccess({ providers, next, disabled }: { providers: OAuthProvider[]; next?: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(signInWithOAuthAction, { message: "" });
  return <div className="mb-6">
    <form action={action} className="grid gap-3">
      <input type="hidden" name="next" value={next ?? "/aportar"} />
      {(["google", "apple"] as const).map(provider => {
        const enabled = providers.includes(provider);
        const label = provider === "google" ? "Google" : "Apple";
        return <Button key={provider} type="submit" name="provider" value={provider} variant="outline" className="h-12 w-full" disabled={disabled || pending || !enabled}>
          {pending ? "Un momento…" : `Continuar con ${label}`}{!enabled && <span className="text-[10px] font-normal text-muted-foreground">Próximamente</span>}
        </Button>;
      })}
    </form>
    <p role="status" className="mt-2 text-xs text-primary">{state.message}</p>
    <div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />O CON TU CORREO<span className="h-px flex-1 bg-border" /></div>
  </div>;
}

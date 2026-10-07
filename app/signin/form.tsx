"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { Submit } from "@/components/submit";

export function SignInForm() {
  const [state, action] = useActionState(signIn, null as { error?: string } | null);
  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2 text-[14px] font-semibold">Demo ID
        <input name="demo_id" className="input" placeholder="e.g. michael" autoComplete="username" required minLength={3} />
      </label>
      <label className="flex flex-col gap-2 text-[14px] font-semibold">Passcode
        <input name="passcode" type="password" className="input" autoComplete="current-password" required minLength={4} />
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn-ink">{state.error}</p>}
      <Submit className="btn btn-primary mt-1 w-full" pending="Signing in…">Continue <span className="arr" aria-hidden="true">→</span></Submit>
    </form>
  );
}

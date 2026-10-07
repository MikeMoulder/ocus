"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { Submit } from "@/components/submit";

export function SignInForm() {
  const [state, action] = useActionState(signIn, null as { error?: string } | null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[14px] font-medium">Demo ID
        <input name="demo_id" className="input" placeholder="e.g. michael" autoComplete="username" required minLength={3} />
      </label>
      <label className="flex flex-col gap-1.5 text-[14px] font-medium">Passcode
        <input name="passcode" type="password" className="input" autoComplete="current-password" required minLength={4} />
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn-ink">{state.error}</p>}
      <Submit pending="Signing in…">Continue</Submit>
    </form>
  );
}

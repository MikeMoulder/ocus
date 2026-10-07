"use client";
import { useFormStatus } from "react-dom";

export function Submit({ children, pending, className = "btn btn-primary", disabled }: { children: React.ReactNode; pending?: string; className?: string; disabled?: boolean }) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} disabled={busy || disabled} aria-busy={busy}>
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {busy ? pending || "Working…" : children}
    </button>
  );
}

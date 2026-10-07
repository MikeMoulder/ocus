"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshGmail } from "@/app/actions";

// Polls Agent37 every 2s until the Gmail connection is ACTIVE (works on localhost, where there's no https callback).
export function GmailStatus({ initial, hasInstance }: { initial: boolean; hasInstance: boolean }) {
  const [active, setActive] = useState(initial);
  const [status, setStatus] = useState(initial ? "ACTIVE" : hasInstance ? "checking" : "NOT_CONNECTED");
  const router = useRouter();
  useEffect(() => {
    if (active || !hasInstance) return;
    let n = 0;
    const t = setInterval(async () => {
      const r = await refreshGmail();
      setStatus(r.status ?? "NOT_CONNECTED");
      if (r.active) { setActive(true); clearInterval(t); router.refresh(); }
      if (++n > 150) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [active, hasInstance, router]);
  if (active) return <span className="rounded-lg bg-accent-soft px-3 py-2 text-[15px] font-semibold text-accent-ink">✓ Gmail connected</span>;
  if (!hasInstance) return null;
  return <span className="text-[14px] text-muted" aria-live="polite">Waiting for Google… ({status.toLowerCase()})</span>;
}

"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the server page every few seconds while the agent is working.
export function AutoRefresh({ ms = 3000, active = true }: { ms?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [router, ms, active]);
  return null;
}

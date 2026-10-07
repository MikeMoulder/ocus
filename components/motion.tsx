"use client";
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Adds .is-in to every [data-reveal] element once it scrolls into view, including ones added after client navigation.
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return null;
}

// Counts from 0 to `value` the first time it is visible.
export function CountUp({ value, ms = 1400, decimals = 0, suffix = "" }: { value: number; ms?: number; decimals?: number; suffix?: string }) {
  const [n, setN] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduced() || !ref.current || value === 0) return;
    setN(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setN(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, ms]);
  return <span ref={ref} className="tabular-nums">{n.toFixed(decimals)}{suffix}</span>;
}

export type ScanRow = { company: string; title: string; where: string; open: boolean; why: string };

// Hero: replays a real scan. Postings arrive one by one; closed ones get the red pen, open ones get the highlighter.
export function ScanReplay({ rows, total, open }: { rows: ScanRow[]; total: number; open: number }) {
  const [n, setN] = useState(0);
  const [cycle, setCycle] = useState(0);
  const VISIBLE = 5;
  useEffect(() => {
    if (reduced()) { setN(rows.length); return; }
    if (n >= rows.length) {
      const t = setTimeout(() => { setN(0); setCycle((c) => c + 1); }, 5200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : 1050);
    return () => clearTimeout(t);
  }, [n, rows.length]);

  const shown = rows.slice(0, n);
  const openSeen = shown.filter((r) => r.open).length;
  const done = n >= rows.length;
  const scanned = done ? total : Math.round((n / rows.length) * total * 0.96);
  const openCount = done ? open : Math.min(open, openSeen);
  const closedCount = scanned - openCount;

  return (
    <div className="card-hot relative overflow-hidden rounded-[14px] bg-card" aria-label={`Replay of a real scan: ${total - open} of ${total} remote jobs were closed to someone living in Nigeria`}>
      <div className="flex items-center justify-between border-b border-ink px-4 py-3 sm:px-5">
        <span className="mono flex items-center gap-2.5 text-[11.5px] font-medium uppercase tracking-[.1em]">
          <span className={done ? "live live-go" : "live"} aria-hidden="true" />{done ? "Scan complete" : "Scanning postings"}
        </span>
        <span className="mono text-[11.5px] uppercase tracking-[.1em] text-muted">Lagos · 08:00</span>
      </div>

      <dl className="grid grid-cols-3 border-b border-line" aria-hidden="true">
        {[["Scanned", scanned, ""], ["Closed to you", closedCount, "text-signal-ink"], ["Open to you", openCount, "text-go-ink"]].map(([k, v, c], i) => (
          <div key={k as string} className={`flex flex-col gap-0.5 px-4 py-3 sm:px-5 ${i ? "border-l border-line" : ""}`}>
            <dt className="mono text-[10.5px] uppercase tracking-[.1em] text-muted">{k}</dt>
            <dd className={`display text-[30px] leading-none tabular-nums sm:text-[36px] ${c}`}>{v as number}</dd>
          </div>
        ))}
      </dl>

      <ol className="relative flex h-[410px] flex-col overflow-hidden" aria-hidden="true">
        {!done && <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-signal/10 to-transparent" style={{ animation: "scan 2.4s linear infinite" }} />}
        {shown.slice(-VISIBLE).reverse().map((r) => (
          <li key={`${cycle}-${r.company}-${r.title}-${r.where}`} className="flex-none border-b border-line/70 px-4 py-3 sm:px-5" style={{ animation: "row-in .5s var(--ease) both" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="mono text-[11px] uppercase tracking-[.08em] text-muted">{r.company}</span>
                <span className={`truncate text-[15px] font-semibold leading-tight ${r.open ? "" : "text-ink-2"}`}>
                  <span className={r.open ? "hl hl-anim" : ""}>{r.title}</span>
                </span>
                <span className="truncate text-[13px] text-muted">
                  <span className={r.open ? "" : "strike strike-anim"}>{r.where}</span>
                </span>
              </div>
              <span className={`stamp mt-1 ${r.open ? "text-go-ink" : "text-signal"}`} style={{ animation: "stamp-in .45s var(--ease) .7s both" }}>{r.why}</span>
            </div>
          </li>
        ))}
        {n === 0 && <li className="mono px-5 py-6 text-[12px] uppercase tracking-[.1em] text-muted">Reading LinkedIn and company careers pages…</li>}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
      </ol>

      <p className="border-t border-line px-4 py-3 text-[12px] leading-snug text-muted sm:px-5">
        Replay of a real test search, Oct 2026. Postings and locations as listed.
      </p>
    </div>
  );
}

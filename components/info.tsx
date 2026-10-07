"use client";
import { useEffect, useId, useRef, useState } from "react";

// Small ⓘ button next to a label. Hover or focus shows the explanation on desktop; tap toggles it on phones.
export function Info({ children, label = "What is this?" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full serif border border-muted/60 text-[12px] italic leading-none text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper">
        i
      </button>
      {open && (
        <span role="tooltip" id={id}
          className="absolute left-1/2 top-full z-20 mt-2 w-[260px] -translate-x-1/2 enter rounded-[10px] bg-ink px-3.5 py-3 text-[13px] font-normal not-italic leading-relaxed text-paper shadow-[4px_4px_0_var(--signal)] sm:left-0 sm:translate-x-0">
          {children}
        </span>
      )}
    </span>
  );
}

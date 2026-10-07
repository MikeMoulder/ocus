// Ring that fills to the job's fit score (0 to 100) on load.
export function ScoreDial({ score }: { score: number }) {
  const r = 38, c = 2 * Math.PI * r;
  return (
    <div className="relative h-[96px] w-[96px]" role="img" aria-label={`Fit score ${score} out of 100`}>
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--soft)" strokeWidth="7" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={score >= 70 ? "var(--go-ink)" : score >= 50 ? "var(--ink)" : "var(--muted)"} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} style={{ ["--off" as string]: c * (1 - score / 100), ["--full" as string]: c, strokeDashoffset: c * (1 - score / 100), animation: "dial 1.2s var(--ease) .2s both" }} />
      </svg>
      <span className="display absolute inset-0 flex items-center justify-center text-[34px] leading-none tabular-nums">{score}</span>
    </div>
  );
}

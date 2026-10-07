import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listJobs, Job } from "@/lib/db";
import { AppHeader, Badge } from "@/components/ui";
import { Submit } from "@/components/submit";
import { pauseAutopilot, runSearchAction, startAutopilot } from "@/app/actions";
import { AutoRefresh } from "@/components/refresh";

function JobCard({ j, highlight }: { j: Job; highlight?: boolean }) {
  const label = j.status === "submitted" ? `Applied ${new Date(j.applied_at || j.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : j.status === "failed" ? "Needs you" : j.status === "applying" || j.status === "approved" ? "Applying…"
    : j.score != null ? `${j.score} · ${j.fit === "fit" ? "Fit" : j.fit === "stretch" ? "Stretch" : "No"}` : "Scoring…";
  const tone = j.status === "submitted" ? "fit" : j.status === "failed" ? "warn" : j.fit === "fit" ? "fit" : j.fit === "stretch" ? "stretch" : "no";
  return (
    <Link href={`/jobs/${j.id}`} className={`flex flex-col gap-2 rounded-xl bg-card p-3.5 text-ink no-underline hover:shadow-sm ${highlight ? "border-2 border-accent" : "border border-line"}`}>
      <span className="text-[13px] font-medium text-muted">{j.company} · <span className="font-normal">{j.source.startsWith("LinkedIn") ? "LinkedIn" : "Careers page"}</span></span>
      <h3 className="text-[16px] font-semibold leading-snug">{j.title}</h3>
      <span className="line-clamp-1 text-[13px] text-muted">{j.location}</span>
      <Badge tone={tone as any}>{label}</Badge>
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ started?: string }> }) {
  const { started } = await searchParams;
  const u = await currentUser();
  if (!u) redirect("/signin");
  if (!u.resume) redirect("/onboard");
  const jobs = await listJobs(u.id);
  const totals = (u as any).totals || { scanned: 0, hidden: 0 };
  const visible = jobs.filter((j) => j.status !== "hidden" && j.status !== "skipped");
  const cols = [
    { title: "Matched", jobs: visible.filter((j) => j.status === "scored" && j.fit !== "no") },
    { title: "Awaiting you", jobs: visible.filter((j) => ["tailored", "awaiting_approval"].includes(j.status)) },
    { title: "Applied", jobs: visible.filter((j) => ["approved", "applying", "submitted", "failed"].includes(j.status)) },
  ];
  const noFit = visible.filter((j) => j.status === "scored" && j.fit === "no");
  const unscored = visible.filter((j) => j.status === "found").length;
  const SHOW = 6;
  const hidden = jobs.filter((j) => j.status === "hidden");
  const applied = jobs.filter((j) => j.status === "submitted").length;
  const stats = [
    { label: "Jobs scanned", value: Math.max(totals.scanned, jobs.length), sub: "LinkedIn + company careers pages" },
    { label: "Not open to you", value: hidden.length, sub: "Matching roles hidden automatically", muted: true },
    { label: "Applications sent", value: applied, sub: "All approved by you", accent: true },
    { label: "Time saved", value: `${((applied * 40) / 60).toFixed(1)} h`, sub: "≈ 40 min per application", accent: true },
  ];
  const searching = Boolean((u as any).searching && Date.now() - Date.parse((u as any).searching) < 5 * 60_000);
  const ap = (u as any).autopilot || {};
  const lagos = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "2-digit" });
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }));

  return (
    <div className="min-h-screen bg-bg">
      <AutoRefresh active={searching} ms={3000} />
      <AppHeader user={u} active="dashboard" />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-7 px-4 py-9 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[30px] font-bold tracking-[-0.02em]">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {u.name || u.demo_id}</h1>
            <p className="text-[15px] text-muted">{totals.last ? `Last search: ${new Date(totals.last).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} (Lagos time)` : "No search yet. Run your first one."}</p>
          </div>
        </div>

        {started && (
          <div className="rounded-xl bg-accent-soft px-5 py-4 text-[15px] leading-relaxed text-accent-ink" role="status">
            <b>Your agent is on it.</b> It&apos;s searching now and will email {u.email || "you"} the best matches to approve in a few minutes.
            You can close this page.
          </div>
        )}

        <section className={`card flex flex-wrap items-center justify-between gap-4 px-5 py-4 ${ap.enabled ? "" : "bg-soft"}`}>
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 flex-none rounded-full ${searching ? "animate-pulse bg-accent" : ap.enabled ? "bg-accent" : "bg-muted"}`} aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold">
                {searching ? "Autopilot is working: searching and preparing matches…" : ap.enabled ? "Autopilot is on" : "Autopilot is off"}
              </span>
              <span className="text-[13px] text-muted">
                {ap.enabled
                  ? `Searches daily at 8:00 AM Lagos time${ap.next_run ? ` · next ${lagos(ap.next_run)}` : ""}${ap.last_result ? ` · last run: ${ap.last_result}` : ""}`
                  : "Turn it on and your agent emails you matches to approve every day."}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!searching && (
              <form action={runSearchAction}><Submit className="btn btn-outline min-h-10 px-4 text-[14px]" pending="Starting…">↻ Run now</Submit></form>
            )}
            {ap.enabled
              ? <form action={pauseAutopilot}><Submit className="btn btn-ghost min-h-10 px-4 text-[14px]" pending="Pausing…">Pause</Submit></form>
              : <form action={startAutopilot}><Submit className="btn btn-primary min-h-10 px-4 text-[14px]" pending="Starting…">Turn on autopilot</Submit></form>}
          </div>
        </section>

        {!u.gmail_active && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-5 py-3 text-[15px] text-warn-ink">
            <span>Connect Gmail so your agent can ask for approval and confirm applications.</span>
            <Link href="/onboard" className="font-semibold text-warn-ink">Connect →</Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card flex flex-col gap-1 px-4 py-4 sm:gap-1.5 sm:px-5 sm:py-5">
              <span className="text-[14px] text-muted">{s.label}</span>
              <span className={`text-[30px] font-bold tracking-[-0.03em] sm:text-[38px] ${s.accent ? "text-accent" : s.muted ? "text-muted" : ""}`}>{s.value}</span>
              <span className="text-[12px] leading-snug text-muted sm:text-[13px]">{s.sub}</span>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-4 md:grid-cols-3">
          {cols.map((c) => (
            <section key={c.title} className="flex flex-col gap-2.5 rounded-2xl bg-soft p-3.5">
              <h2 className="flex justify-between px-1.5 py-1 font-mono text-[13px] uppercase tracking-[0.06em] text-ink-2">{c.title}<span>{c.jobs.length}</span></h2>
              {c.jobs.slice(0, SHOW).map((j, i) => <JobCard key={j.id} j={j} highlight={c.title === "Awaiting you" && i === 0} />)}
              {c.jobs.length > SHOW && (
                <details className="flex flex-col gap-2.5">
                  <summary className="cursor-pointer px-1.5 py-1 text-[14px] font-semibold text-accent">Show {c.jobs.length - SHOW} more</summary>
                  <div className="mt-2.5 flex flex-col gap-2.5">{c.jobs.slice(SHOW).map((j) => <JobCard key={j.id} j={j} />)}</div>
                </details>
              )}
              {!c.jobs.length && (
                <p className="px-1.5 pb-2 text-[14px] leading-relaxed text-muted">
                  {c.title === "Matched" ? "Run a search to find jobs." : c.title === "Awaiting you" ? "Open a matched job and tap Prepare application." : "Approve a job and your agent applies here."}
                </p>
              )}
            </section>
          ))}
        </div>

        {unscored > 0 && (
          <p className="-mt-2 text-[14px] text-muted">
            {unscored} more jobs are open to you but haven&apos;t been scored yet. Each search scores the 16 that best match your skills.
          </p>
        )}
        {noFit.length > 0 && (
          <details className="card px-5 py-4">
            <summary className="cursor-pointer text-[15px] font-semibold">{noFit.length} open to you, but not a fit right now</summary>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] text-ink-2">
              {noFit.map((j) => <li key={j.id}><Link href={`/jobs/${j.id}`}>{j.company} – {j.title}</Link> <span className="text-muted">· {j.reasons?.[0]}</span></li>)}
            </ul>
          </details>
        )}
        {hidden.length > 0 && (
          <details className="card px-5 py-4">
            <summary className="cursor-pointer text-[15px] font-semibold">{hidden.length} matching jobs hidden: not open to someone in Nigeria</summary>
            <ul className="mt-3 flex max-h-[320px] flex-col gap-1.5 overflow-auto text-[14px] text-ink-2">
              {hidden.slice(0, 80).map((j) => <li key={j.id}>{j.company} – {j.title} <span className="text-muted">· {j.eligibility_reason}</span></li>)}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
}

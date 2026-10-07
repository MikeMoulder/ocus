import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listJobs, Job } from "@/lib/db";
import { AppHeader, Badge, PageHead } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { Submit } from "@/components/submit";
import { pauseAutopilot, runSearchAction, startAutopilot } from "@/app/actions";
import { AutoRefresh } from "@/components/refresh";

function JobCard({ j, highlight, i = 0 }: { j: Job; highlight?: boolean; i?: number }) {
  const label = j.status === "submitted" ? `Applied ${new Date(j.applied_at || j.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : j.status === "failed" ? "Needs you" : j.status === "applying" || j.status === "approved" ? "Applying…"
    : j.score != null ? (j.fit === "fit" ? "Fit" : j.fit === "stretch" ? "Stretch" : "No") : "Scoring…";
  const tone = j.status === "submitted" ? "fit" : j.status === "failed" ? "warn" : j.fit === "fit" ? "fit" : j.fit === "stretch" ? "stretch" : "no";
  return (
    <Link href={`/jobs/${j.id}`} style={{ ["--i" as string]: i + 4 }}
      className={`enter group flex flex-col gap-3 rounded-[12px] bg-card p-4 text-ink no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)] ${highlight ? "card-hot" : "border border-line hover:border-ink"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="mono truncate text-[11px] uppercase tracking-[.08em] text-muted">{j.company} · {j.source.startsWith("LinkedIn") ? "LinkedIn" : "Careers page"}</span>
          <h3 className="text-[16px] font-semibold leading-snug group-hover:underline">{j.title}</h3>
        </div>
        {j.score != null && !["submitted", "failed", "applying", "approved"].includes(j.status) && (
          <span className="display flex-none text-[30px] leading-none tabular-nums">{j.score}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone as any}>{label}</Badge>
        <span className="line-clamp-1 text-right text-[12.5px] text-muted">{j.location}</span>
      </div>
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
    { label: "Jobs scanned", value: Math.max(totals.scanned, jobs.length), sub: "LinkedIn and company careers pages" },
    { label: "Closed to you", value: hidden.length, sub: "Hidden automatically", tone: "text-signal-ink" },
    { label: "Applications sent", value: applied, sub: "Every one approved by you" },
    { label: "Time saved", value: (applied * 40) / 60, decimals: 1, suffix: " h", sub: "About 40 min per application" },
  ];
  const searching = Boolean((u as any).searching && Date.now() - Date.parse((u as any).searching) < 5 * 60_000);
  const ap = (u as any).autopilot || {};
  const lagos = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "2-digit" });
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }));

  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen">
      <AutoRefresh active={searching} ms={3000} />
      <AppHeader user={u} active="dashboard" />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14">
        <PageHead kicker={`${today} · Lagos`}
          title={<>Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, <em>{u.name || u.demo_id}.</em></>}
          sub={totals.last ? `Last search ${new Date(totals.last).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })}, Lagos time. Everything your agent found and prepared is below.` : "No search yet. Run your first one and your agent fills this page."} />

        {started && (
          <div className="enter card-hot flex flex-col gap-1 rounded-[14px] bg-go px-5 py-4 text-[15px] leading-relaxed" role="status">
            <b className="serif text-[20px] font-normal">Your agent is on it.</b>
            <span>It&apos;s searching now and will email {u.email || "you"} the best matches to approve in a few minutes. You can close this page.</span>
          </div>
        )}

        <section style={{ ["--i" as string]: 1 }}
          className={`enter flex flex-wrap items-center justify-between gap-5 rounded-[14px] px-5 py-5 sm:px-6 ${ap.enabled ? "card-hot bg-card" : "border border-dashed border-ink/40"}`}>
          <div className="flex items-center gap-4">
            <span className={`live flex-none ${searching ? "" : ap.enabled ? "live-go" : "live-off"}`} aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="serif text-[22px] leading-tight">
                {searching ? "Autopilot is working: searching and preparing matches…" : ap.enabled ? "Autopilot is on" : "Autopilot is off"}
              </span>
              <span className="mono text-[12px] uppercase leading-relaxed tracking-[.06em] text-muted">
                {ap.enabled
                  ? `Daily at 08:00 Lagos${ap.next_run ? ` · next ${lagos(ap.next_run)}` : ""}${ap.last_result ? ` · last run: ${ap.last_result}` : ""}`
                  : "Turn it on and your agent emails you matches to approve every day"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!searching && (
              <form action={runSearchAction}><Submit className="btn btn-outline btn-sm" pending="Starting…">↻ Run now</Submit></form>
            )}
            {ap.enabled
              ? <form action={pauseAutopilot}><Submit className="btn btn-ghost btn-sm" pending="Pausing…">Pause</Submit></form>
              : <form action={startAutopilot}><Submit className="btn btn-primary btn-sm" pending="Starting…">Turn on autopilot</Submit></form>}
          </div>
        </section>

        {!u.gmail_active && (
          <div className="enter flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-warn-soft px-5 py-3.5 text-[15px] text-warn-ink" style={{ ["--i" as string]: 2 }}>
            <span>Connect Gmail so your agent can ask for approval and confirm applications.</span>
            <Link href="/onboard#gmail" className="font-semibold">Connect Gmail →</Link>
          </div>
        )}

        <dl className="enter grid grid-cols-2 overflow-hidden rounded-[14px] border border-ink bg-card lg:grid-cols-4" style={{ ["--i" as string]: 2 }}>
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col gap-1.5 px-4 py-5 sm:px-6 sm:py-6 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
              <dt className="mono text-[11px] uppercase tracking-[.1em] text-muted">{s.label}</dt>
              <dd className={`display text-[40px] leading-none sm:text-[52px] ${s.tone || ""}`}><CountUp value={s.value} decimals={s.decimals || 0} suffix={s.suffix || ""} /></dd>
              <dd className="text-[12.5px] leading-snug text-muted">{s.sub}</dd>
            </div>
          ))}
        </dl>

        <div className="grid items-start gap-6 md:grid-cols-3 md:gap-5">
          {cols.map((c, ci) => (
            <section key={c.title} className="flex flex-col gap-3">
              <h2 className="enter flex items-baseline justify-between border-b border-ink pb-2" style={{ ["--i" as string]: 3 + ci }}>
                <span className="mono text-[12px] uppercase tracking-[.1em]">{c.title}</span>
                <span className="display text-[28px] leading-none">{c.jobs.length}</span>
              </h2>
              {c.jobs.slice(0, SHOW).map((j, i) => <JobCard key={j.id} j={j} i={i} highlight={c.title === "Awaiting you" && i === 0} />)}
              {c.jobs.length > SHOW && (
                <details className="group flex flex-col gap-3">
                  <summary className="mono cursor-pointer list-none py-1 text-[12px] uppercase tracking-[.1em] text-signal-ink hover:underline">+ Show {c.jobs.length - SHOW} more</summary>
                  <div className="mt-3 flex flex-col gap-3">{c.jobs.slice(SHOW).map((j) => <JobCard key={j.id} j={j} />)}</div>
                </details>
              )}
              {!c.jobs.length && (
                <p className="enter rounded-[12px] border border-dashed border-line px-4 py-6 text-[14px] leading-relaxed text-muted" style={{ ["--i" as string]: 4 }}>
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
        <div className="flex flex-col gap-3">
          {noFit.length > 0 && (
            <details className="group card px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
                {noFit.length} open to you, but not a fit right now<span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3 text-[14px] text-ink-2">
                {noFit.map((j) => <li key={j.id}><Link href={`/jobs/${j.id}`}>{j.company}, {j.title}</Link> <span className="text-muted">· {j.reasons?.[0]}</span></li>)}
              </ul>
            </details>
          )}
          {hidden.length > 0 && (
            <details className="group card px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
                <span><span className="text-signal-ink">{hidden.length}</span> matching jobs hidden: not open to someone in Nigeria</span>
                <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <ul className="mt-3 flex max-h-[340px] flex-col gap-2 overflow-auto border-t border-line pt-3 text-[14px] text-ink-2">
                {hidden.slice(0, 80).map((j) => (
                  <li key={j.id} title={j.eligibility_reason} className="flex flex-wrap items-baseline gap-x-3">
                    <span>{j.company}, {j.title}</span>
                    <span className="mono text-[12px] text-muted"><span className="strike">{j.location}</span></span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}

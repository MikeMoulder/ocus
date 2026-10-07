import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listEvents, listJobs } from "@/lib/db";
import { AppHeader, PageHead } from "@/components/ui";
import { AutoRefresh } from "@/components/refresh";

const TONE: Record<string, string> = {
  APPLIED: "bg-go text-ink", APPROVED: "bg-go text-ink", GMAIL: "bg-go text-ink",
  FILTERED: "bg-signal-soft text-signal-ink", BLOCKED: "bg-warn-soft text-warn-ink", ERROR: "bg-signal text-white",
};

export default async function Activity() {
  const u = await currentUser();
  if (!u) redirect("/signin");
  const [events, jobs] = await Promise.all([listEvents(u.id), listJobs(u.id)]);
  const running = jobs.find((j) => j.status === "applying" || j.status === "approved");
  const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long" });
  const shown = events.slice(0, 150);
  return (
    <div className="min-h-screen">
      <AutoRefresh ms={running ? 2500 : 8000} />
      <AppHeader user={u} active="activity" />
      <main className="mx-auto flex max-w-[960px] flex-col gap-8 px-4 py-10 sm:px-8 sm:py-14">
        <PageHead kicker="Activity" title={<>What your agent <em>did.</em></>}
          sub="Every search, filter, draft, email and application, newest first. Times are Lagos time.">
          <span className="mono inline-flex items-center gap-2.5 rounded-full border border-ink bg-card px-3.5 py-2 text-[11px] uppercase tracking-[.08em]">
            <span className={`live ${running ? "" : "live-off"}`} />
            {running ? "Working" : "Idle"} · private Agent37 computer{u.agent37_instance_id ? ` ${u.agent37_instance_id}` : ""}
          </span>
        </PageHead>
        {running && (
          <Link href={`/jobs/${running.id}`} className="enter card-hot flex flex-col gap-1 rounded-[14px] bg-card p-5 text-ink no-underline" style={{ ["--i" as string]: 1 }}>
            <span className="mono flex items-center gap-2 text-[11px] uppercase tracking-[.1em] text-signal-ink"><span className="live" />Now</span>
            <h2 className="serif text-[24px] leading-tight">Applying to {running.company}, {running.title}</h2>
          </Link>
        )}
        {shown.length === 0 && (
          <p className="enter rounded-[14px] border border-dashed border-ink/40 px-6 py-10 text-center text-[15px] text-muted" style={{ ["--i" as string]: 1 }}>
            Nothing yet. <Link href="/dashboard" className="font-semibold text-ink">Run a search from the dashboard →</Link>
          </p>
        )}
        <ol className="flex flex-col">
          {shown.map((e, i) => {
            const d = day(e.at);
            const newDay = i === 0 || day(shown[i - 1].at) !== d;
            return (
              <li key={e.id} className="enter" style={{ ["--i" as string]: Math.min(i, 12) + 1 }}>
                {newDay && <h2 className="mono mb-1 mt-6 border-b border-ink pb-2 text-[11px] uppercase tracking-[.1em] first:mt-0">{d}</h2>}
                <div className="grid grid-cols-[52px_1fr] items-baseline gap-x-4 gap-y-1 border-b border-line py-3 text-[15px] sm:grid-cols-[52px_96px_1fr]">
                  <span className="mono text-[12px] text-muted">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                  <span className={`tag justify-self-start ${TONE[e.kind] || "bg-soft text-ink-2"}`}>{e.kind}</span>
                  <span className="col-span-2 min-w-0 break-words leading-snug sm:col-span-1">{e.job_id ? <Link href={`/jobs/${e.job_id}`} className="text-ink no-underline hover:underline">{e.text}</Link> : e.text}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}

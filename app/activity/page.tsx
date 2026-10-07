import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listEvents, listJobs } from "@/lib/db";
import { AppHeader } from "@/components/ui";
import { AutoRefresh } from "@/components/refresh";

const TONE: Record<string, string> = {
  APPLIED: "bg-accent-soft text-accent-ink", APPROVED: "bg-accent-soft text-accent-ink", GMAIL: "bg-accent-soft text-accent-ink",
  FILTERED: "bg-warn-soft text-warn-ink", BLOCKED: "bg-warn-soft text-warn-ink", ERROR: "bg-[#FBE4E4] text-[#9B1C1C]",
};

export default async function Activity() {
  const u = await currentUser();
  if (!u) redirect("/signin");
  const [events, jobs] = await Promise.all([listEvents(u.id), listJobs(u.id)]);
  const running = jobs.find((j) => j.status === "applying" || j.status === "approved");
  return (
    <div className="min-h-screen bg-bg">
      <AutoRefresh ms={running ? 2500 : 8000} />
      <AppHeader user={u} active="activity" />
      <main className="mx-auto flex max-w-[920px] flex-col gap-6 px-4 py-9 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Your agent</h1>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[14px] text-ink-2">
            <span className={`h-2.5 w-2.5 rounded-full ${running ? "animate-pulse bg-accent" : "bg-muted"}`} />
            {running ? "Working" : "Idle"} · private Agent37 computer{u.agent37_instance_id ? ` (${u.agent37_instance_id})` : ""}
          </span>
        </div>
        {running && (
          <Link href={`/jobs/${running.id}`} className="card border-2 border-accent p-5 text-ink no-underline">
            <span className="eyebrow">Now</span>
            <h2 className="mt-1 text-[20px] font-semibold">Applying to {running.company} – {running.title}</h2>
          </Link>
        )}
        <section className="card px-5 py-2">
          {events.length === 0 && <p className="py-6 text-[15px] text-muted">Nothing yet. Run a search from the dashboard.</p>}
          <ul>
            {events.slice(0, 150).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-3.5 border-b border-[#EFEFEA] py-3 text-[15px] last:border-0">
                <span className="w-[52px] flex-none font-mono text-[13px] text-muted">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                <span className={`flex-none rounded-md px-2 py-0.5 text-[12px] font-semibold ${TONE[e.kind] || "bg-soft text-ink-2"}`}>{e.kind}</span>
                <span className="min-w-0 flex-[1_1_300px] break-words leading-snug">{e.job_id ? <Link href={`/jobs/${e.job_id}`} className="text-ink no-underline hover:underline">{e.text}</Link> : e.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

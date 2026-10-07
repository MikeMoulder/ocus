import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentUser, verifyJobToken } from "@/lib/auth";
import { getJob, getUser, listEvents } from "@/lib/db";
import { buildIndex } from "@/lib/guard.mjs";
import { AppHeader, Badge, Logo } from "@/components/ui";
import { Submit } from "@/components/submit";
import { AutoRefresh } from "@/components/refresh";
import { approveAction, prepareAction, saveOutreach, sendApprovalAction, skipAction } from "@/app/actions";

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  const job = await getJob(id);
  if (!job) notFound();
  const me = await currentUser();
  const viaToken = !me && t ? await verifyJobToken(t, id) : null;
  if (me?.id !== job.user_id && viaToken !== job.user_id) redirect("/signin");
  const user = me ?? (await getUser(job.user_id))!;
  const events = await listEvents(user.id, job.id);
  const { src } = buildIndex(user.resume);
  const preparing = Boolean((job as any).preparing && Date.now() - Date.parse((job as any).preparing) < 5 * 60_000);
  const busy = job.status === "approved" || job.status === "applying" || preparing;
  const prepared = Boolean(job.tailored);
  const decided = ["approved", "applying", "submitted", "failed", "skipped"].includes(job.status);
  const tq = t ? t : undefined;

  const lines: { where: string; text: string; ids: string[] }[] = [];
  if (job.tailored) {
    const tl = job.tailored;
    if (tl.summary) lines.push({ where: "Summary", text: tl.summary.text, ids: tl.summary.source_ids || [] });
    for (const p of tl.projects || []) {
      const name = user.resume.projects?.find((x: any) => x.id === p.id)?.name || p.id;
      for (const b of p.bullets) lines.push({ where: name, text: b.text, ids: b.source_ids || [b.source_id] });
    }
    for (const e of tl.experience || []) {
      const name = user.resume.experience?.find((x: any) => x.id === e.id)?.company || e.id;
      for (const b of e.bullets) lines.push({ where: name, text: b.text, ids: b.source_ids || [b.source_id] });
    }
  }
  const person = job.contact?.person;

  return (
    <div className="min-h-screen bg-bg">
      <AutoRefresh active={busy} />
      {me ? <AppHeader user={me} /> : (
        <header className="border-b border-line bg-card"><div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-4 sm:px-8"><Logo /><span className="text-[14px] text-muted">Opened from your approval email</span></div></header>
      )}
      <main className="mx-auto grid max-w-[1240px] gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {me && <Link href="/dashboard" className="text-[14px]">← Dashboard</Link>}
          <section className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-muted">{job.company} · via {job.source}</span>
                <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{job.title}</h1>
                <span className="text-[15px] text-ink-2">{job.location}</span>
              </div>
              {job.score != null && (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-accent">{job.score}</span>
                  <Badge tone={(job.fit || "no") as any}>{job.fit === "fit" ? "Fit" : job.fit === "stretch" ? "Stretch" : "Not a fit"}</Badge>
                </div>
              )}
            </div>
            <p className={`rounded-lg px-3 py-2 text-[14px] ${job.eligible === false ? "bg-warn-soft text-warn-ink" : "bg-accent-soft text-accent-ink"}`}>
              {job.eligible === false ? "✕ " : "✓ "}{job.eligibility_reason}
            </p>
            {job.reasons?.length ? (
              <ul className="flex flex-col gap-1.5 text-[15px] leading-relaxed text-ink-2">
                {job.reasons.map((r, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{r}</li>)}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3 text-[14px]">
              <a href={job.url} target="_blank" rel="noreferrer">View posting ↗</a>
              {job.apply_url && job.apply_url !== job.url && <a href={job.apply_url} target="_blank" rel="noreferrer">Application page ↗</a>}
            </div>
            {preparing && (
              <p className="flex items-center gap-3 border-t border-line pt-4 text-[15px] text-accent" aria-live="polite">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                Tailoring your resume and finding the hiring contact… (~1 min)
              </p>
            )}
            {!prepared && !preparing && me && job.eligible !== false && (
              <form action={prepareAction.bind(null, job.id)} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Submit pending="Starting…">Prepare application</Submit>
                <span className="text-[14px] text-muted">Tailors your resume, checks every line, finds who&apos;s hiring and drafts a note.</span>
              </form>
            )}
          </section>

          {prepared && (
            <section className="card flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[20px] font-semibold">Tailored resume</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={job.guard?.ok ? "fit" : "warn"}>{job.guard?.ok ? "✓" : "!"} {job.guard?.cited} of {job.guard?.total} lines cite your resume</Badge>
                  <a className="btn btn-ghost min-h-9 px-3 text-[14px]" href={`/api/jobs/${job.id}/pdf${tq ? `?t=${tq}` : ""}`} target="_blank" rel="noreferrer">Open PDF ↗</a>
                </div>
              </div>
              {job.tailored?.changes?.length ? (
                <ul className="flex flex-col gap-1 text-[14px] text-ink-2">{job.tailored.changes.map((c: string, i: number) => <li key={i}>→ {c}</li>)}</ul>
              ) : null}
              {job.tailored?.removed?.length ? (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Truth guard removed {job.tailored.removed.length} line(s) the AI couldn&apos;t back up: {job.tailored.removed.slice(0, 3).join(" · ")}</p>
              ) : null}
              <div className="flex flex-col gap-5">
                {lines.reduce<{ where: string; items: typeof lines }[]>((g, l) => {
                  if (g.at(-1)?.where === l.where) g.at(-1)!.items.push(l); else g.push({ where: l.where, items: [l] });
                  return g;
                }, []).map((g, gi) => (
                  <div key={gi} className="flex flex-col gap-1">
                    <h3 className="font-mono text-[12px] uppercase tracking-[0.06em] text-muted">{g.where}</h3>
                    <ul className="flex flex-col divide-y divide-line">
                      {g.items.map((l, i) => (
                        <li key={i} className="flex flex-col gap-1 py-2.5">
                          <p className="text-[15px] leading-relaxed">{l.text}</p>
                          <details className="text-[13px] text-muted">
                            <summary className="cursor-pointer select-none hover:text-ink-2">Source: {l.ids.join(", ")}</summary>
                            {l.ids.map((sid) => <p key={sid} className="mt-1.5 border-l-2 border-accent/40 pl-3 leading-relaxed">{src.get(sid) || "(missing)"}</p>)}
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-[14px] text-ink-2"><b>Skills:</b> {(job.tailored?.skills || []).join(" · ")}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {prepared && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="text-[18px] font-semibold">Hiring contact</h2>
              {person ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[16px] font-semibold">{person.name}</span>
                  <span className="text-[14px] text-ink-2">{person.title} · {job.company}</span>
                  {person.linkedin_url && <a href={person.linkedin_url} target="_blank" rel="noreferrer" className="text-[14px]">LinkedIn profile ↗</a>}
                  <span className="mt-1 text-[12px] text-muted">Found via Apollo on Monid · {job.contact.candidates} people checked</span>
                </div>
              ) : <p className="text-[14px] text-muted">No public contact found. The note below is for the hiring team.</p>}
              <form action={saveOutreach.bind(null, job.id)} className="flex flex-col gap-2">
                <label className="text-[14px] font-medium" htmlFor="outreach">Your note (you send it)</label>
                <textarea id="outreach" name="outreach" rows={8} defaultValue={job.outreach} className="input py-2 text-[14px] leading-relaxed" readOnly={!me} />
                {me && <Submit className="btn btn-ghost min-h-9 self-start px-3 text-[14px]" pending="Saving…">Save note</Submit>}
              </form>
            </section>
          )}

          {prepared && !decided && (
            <form id="approve" action={approveAction.bind(null, job.id, tq)} className="card card-hot flex scroll-mt-4 flex-col gap-4 p-5">
              <h2 className="text-[18px] font-semibold">Screening answers</h2>
              {(job.questions || []).map((q, i) => (
                <label key={i} className="flex flex-col gap-1 text-[14px] font-medium">
                  <span className="flex items-center justify-between gap-2">{q.q}{!q.a && <span className="soon">needs you</span>}</span>
                  <input name={`q${i}`} defaultValue={q.a || ""} className="input min-h-10 text-[14px] font-normal" required={!q.a} />
                </label>
              ))}
              <Submit pending="Handing it to your agent…">Approve &amp; apply</Submit>
              <p className="text-[13px] text-muted">Your private agent opens the form in its own browser, fills it with these answers and your tailored PDF, and submits.</p>
            </form>
          )}
          {prepared && !decided && (
            <div className="flex flex-col gap-3">
              {me && job.status !== "awaiting_approval" && user.gmail_active && (
                <form action={sendApprovalAction.bind(null, job.id)}>
                  <Submit className="btn btn-outline w-full" pending="Your agent is emailing you…">Email me for approval</Submit>
                </form>
              )}
              {job.status === "awaiting_approval" && <p className="rounded-lg bg-accent-soft px-3 py-2 text-[14px] text-accent-ink">✓ Approval request sent to {user.email}</p>}
              <form action={skipAction.bind(null, job.id, tq)}><Submit className="btn btn-ghost w-full" pending="Skipping…">Skip this job</Submit></form>
            </div>
          )}

          {(decided || events.length > 0) && (
            <section className="card flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold">Agent log</h2>
                {busy && <span className="flex items-center gap-2 text-[13px] font-semibold text-accent"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />Working</span>}
                {job.status === "submitted" && <Badge tone="fit">Applied ✓</Badge>}
                {job.status === "failed" && <Badge tone="warn">Needs you</Badge>}
                {job.status === "skipped" && <Badge>Skipped</Badge>}
              </div>
              <ol className="flex max-h-[420px] flex-col gap-2 overflow-auto text-[13px]">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="w-11 flex-none font-mono text-muted">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                    <span className="break-words text-ink-2"><b className="text-ink">{e.kind}</b> {e.text}</span>
                  </li>
                ))}
              </ol>
              {job.status === "failed" && <a className="btn btn-outline" href={job.apply_url || job.url} target="_blank" rel="noreferrer">Finish manually ↗</a>}
              {job.agent_result && !busy && <details className="text-[13px] text-ink-2"><summary className="cursor-pointer">Agent&apos;s report</summary><pre className="mt-2 whitespace-pre-wrap font-sans">{job.agent_result}</pre></details>}
            </section>
          )}
        </aside>
      </main>
      {prepared && !decided && (
        <div className="sticky bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <a href="#approve" className="btn btn-primary w-full">Review answers &amp; approve ↓</a>
        </div>
      )}
    </div>
  );
}

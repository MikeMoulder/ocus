import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentUser, verifyJobToken } from "@/lib/auth";
import { getJob, getUser, listEvents } from "@/lib/db";
import { buildIndex } from "@/lib/guard.mjs";
import { AppHeader, Badge, Logo } from "@/components/ui";
import { ScoreDial } from "@/components/score";
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

  const groups = lines.reduce<{ where: string; items: typeof lines }[]>((g, l) => {
    if (g.at(-1)?.where === l.where) g.at(-1)!.items.push(l); else g.push({ where: l.where, items: [l] });
    return g;
  }, []);
  const label = (t: string) => <h2 className="mono text-[12px] uppercase tracking-[.1em] text-muted">{t}</h2>;

  return (
    <div className="min-h-screen">
      <AutoRefresh active={busy} />
      {me ? <AppHeader user={me} /> : (
        <header className="border-b border-ink bg-paper"><div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-8"><Logo /><span className="mono text-[11px] uppercase tracking-[.1em] text-muted">Opened from your approval email</span></div></header>
      )}
      <main className="mx-auto grid max-w-[1240px] gap-8 px-4 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1fr_400px] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="enter flex flex-col gap-6">
            {me && <Link href="/dashboard" className="mono self-start text-[12px] uppercase tracking-[.1em] text-muted no-underline hover:text-ink">← Dashboard</Link>}
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span className="mono text-[12px] uppercase tracking-[.1em] text-muted">{job.company} · via {job.source}</span>
                <h1 className="display text-[38px] leading-[1.02] sm:text-[52px]">{job.title}</h1>
                <span className="text-[15px] text-ink-2">{job.location}</span>
              </div>
              {job.score != null && (
                <div className="flex flex-col items-center gap-2">
                  <ScoreDial score={job.score} />
                  <Badge tone={(job.fit || "no") as any}>{job.fit === "fit" ? "Fit" : job.fit === "stretch" ? "Stretch" : "Not a fit"}</Badge>
                </div>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-3 border-y border-ink py-3 text-[14px]">
              <span className={`stamp ${job.eligible === false ? "text-signal" : "text-go-ink"}`}>{job.eligible === false ? "Closed to you" : "Open to you"}</span>
              <span className="text-ink-2">{job.eligibility_reason}</span>
            </p>
            {job.reasons?.length ? (
              <ol className="flex flex-col gap-2.5 text-[16px] leading-relaxed text-ink-2">
                {job.reasons.map((r, i) => <li key={i} className="flex gap-4"><span className="mono pt-0.5 text-[12px] text-signal-ink">0{i + 1}</span>{r}</li>)}
              </ol>
            ) : null}
            <div className="flex flex-wrap gap-5 text-[14px] font-semibold">
              <a href={job.url} target="_blank" rel="noreferrer">View posting ↗</a>
              {job.apply_url && job.apply_url !== job.url && <a href={job.apply_url} target="_blank" rel="noreferrer">Application page ↗</a>}
            </div>
            {preparing && (
              <p className="card flex items-center gap-3 px-5 py-4 text-[15px]" aria-live="polite">
                <span className="live flex-none" aria-hidden="true" />
                Tailoring your resume and finding the hiring contact… (about 1 min)
              </p>
            )}
            {!prepared && !preparing && me && job.eligible !== false && (
              <form action={prepareAction.bind(null, job.id)} className="card-hot flex flex-wrap items-center gap-4 rounded-[14px] bg-card px-5 py-5">
                <Submit pending="Starting…">Prepare application <span className="arr" aria-hidden="true">→</span></Submit>
                <span className="flex-1 basis-[240px] text-[14px] leading-relaxed text-muted">Tailors your resume, checks every line, finds who&apos;s hiring and drafts a note.</span>
              </form>
            )}
          </section>

          {prepared && (
            <section className="enter card flex flex-col overflow-hidden" style={{ ["--i" as string]: 1 }}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <h2 className="serif text-[24px]">Tailored resume</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={job.guard?.ok ? "fit" : "warn"}>{job.guard?.ok ? "✓" : "!"} {job.guard?.cited} of {job.guard?.total} lines cite your resume</Badge>
                  <a className="btn btn-ghost btn-sm" href={`/api/jobs/${job.id}/pdf${tq ? `?t=${tq}` : ""}`} target="_blank" rel="noreferrer">Open PDF ↗</a>
                </div>
              </div>
              <div className="flex flex-col gap-6 px-5 py-5 sm:px-6">
                {job.tailored?.changes?.length ? (
                  <ul className="flex flex-col gap-1.5 rounded-[10px] bg-soft px-4 py-3 text-[14px] text-ink-2">{job.tailored.changes.map((c: string, i: number) => <li key={i} className="flex gap-2"><span className="text-signal-ink">→</span>{c}</li>)}</ul>
                ) : null}
                {job.tailored?.removed?.length ? (
                  <div className="flex flex-col gap-2 rounded-[10px] border border-signal/40 bg-signal-soft/50 px-4 py-3 text-[13px] text-ink-2">
                    <span className="stamp self-start text-signal">Truth guard removed {job.tailored.removed.length}</span>
                    <span>Lines the AI couldn&apos;t back up with your resume: {job.tailored.removed.slice(0, 3).map((x: string, i: number) => <span key={i} className="strike mx-1">{x}</span>)}</span>
                  </div>
                ) : null}
                {groups.map((g, gi) => (
                  <div key={gi} className="flex flex-col gap-1">
                    <h3 className="mono border-b border-ink pb-1.5 text-[11px] uppercase tracking-[.1em]">{g.where}</h3>
                    <ul className="flex flex-col divide-y divide-line">
                      {g.items.map((l, i) => (
                        <li key={i} className="flex flex-col gap-1.5 py-3">
                          <p className="text-[15px] leading-relaxed">{l.text}</p>
                          <details className="group text-[13px] text-muted">
                            <summary className="mono inline-flex cursor-pointer select-none list-none items-center gap-1.5 rounded bg-soft px-1.5 py-0.5 text-[11px] text-ink-2 hover:bg-go">↳ cites {l.ids.join(", ")}</summary>
                            {l.ids.map((sid) => <p key={sid} className="mt-2 border-l-2 border-go-ink/50 pl-3 leading-relaxed">{src.get(sid) || "(missing)"}</p>)}
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <h3 className="mono border-b border-ink pb-1.5 text-[11px] uppercase tracking-[.1em]">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">{(job.tailored?.skills || []).map((k: string) => <span key={k} className="rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[13px] text-ink-2">{k}</span>)}</div>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {prepared && (
            <section className="enter card flex flex-col gap-4 p-5" style={{ ["--i" as string]: 2 }}>
              {label("Hiring contact")}
              {person ? (
                <div className="flex items-center gap-3">
                  <span className="display flex h-12 w-12 flex-none items-center justify-center rounded-[10px] bg-ink text-[20px] text-paper">
                    {String(person.name || "?").split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("")}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[16px] font-semibold">{person.name}</span>
                    <span className="text-[14px] text-ink-2">{person.title} · {job.company}</span>
                    {person.linkedin_url && <a href={person.linkedin_url} target="_blank" rel="noreferrer" className="text-[14px] font-semibold">LinkedIn profile ↗</a>}
                  </div>
                </div>
              ) : <p className="text-[14px] text-muted">No public contact found. The note below is for the hiring team.</p>}
              {person && <span className="mono text-[11px] uppercase tracking-[.08em] text-muted">Found via Apollo on Monid · {job.contact.candidates} people checked</span>}
              <form action={saveOutreach.bind(null, job.id)} className="flex flex-col gap-2 border-t border-line pt-4">
                <label className="text-[14px] font-semibold" htmlFor="outreach">Your note <span className="font-normal text-muted">(you send it)</span></label>
                <textarea id="outreach" name="outreach" rows={8} defaultValue={job.outreach} className="input serif py-3 text-[15px] leading-relaxed" readOnly={!me} />
                {me && <Submit className="btn btn-ghost btn-sm self-start" pending="Saving…">Save note</Submit>}
              </form>
            </section>
          )}

          {prepared && !decided && (
            <form id="approve" action={approveAction.bind(null, job.id, tq)} className="enter card-hot flex scroll-mt-24 flex-col gap-4 rounded-[14px] bg-card p-5" style={{ ["--i" as string]: 3 }}>
              {label("Screening answers")}
              {(job.questions || []).map((q, i) => (
                <label key={i} className="flex flex-col gap-1.5 text-[14px] font-semibold">
                  <span className="flex items-start justify-between gap-2">{q.q}{!q.a && <span className="tag flex-none bg-warn-soft text-warn-ink">Needs you</span>}</span>
                  <input name={`q${i}`} defaultValue={q.a || ""} className="input text-[14px] font-normal" required={!q.a} />
                </label>
              ))}
              <Submit className="btn btn-primary w-full" pending="Handing it to your agent…">Approve and apply <span className="arr" aria-hidden="true">→</span></Submit>
              <p className="text-[13px] leading-relaxed text-muted">Your private agent opens the form in its own browser, fills it with these answers and your tailored PDF, and submits.</p>
            </form>
          )}
          {prepared && !decided && (
            <div className="flex flex-col gap-2.5">
              {me && job.status !== "awaiting_approval" && user.gmail_active && (
                <form action={sendApprovalAction.bind(null, job.id)}>
                  <Submit className="btn btn-outline w-full" pending="Your agent is emailing you…">Email me for approval</Submit>
                </form>
              )}
              {job.status === "awaiting_approval" && <p className="rounded-[10px] bg-go px-3 py-2.5 text-[14px] font-semibold">✓ Approval request sent to {user.email}</p>}
              <form action={skipAction.bind(null, job.id, tq)}><Submit className="btn btn-ghost w-full" pending="Skipping…">Skip this job</Submit></form>
            </div>
          )}

          {(decided || events.length > 0) && (
            <section className="enter card flex flex-col gap-4 p-5" style={{ ["--i" as string]: 4 }}>
              <div className="flex items-center justify-between">
                {label("Agent log")}
                {busy && <span className="mono flex items-center gap-2 text-[11px] uppercase tracking-[.1em] text-signal-ink"><span className="live" />Working</span>}
                {job.status === "submitted" && <Badge tone="fit">Applied ✓</Badge>}
                {job.status === "failed" && <Badge tone="warn">Needs you</Badge>}
                {job.status === "skipped" && <Badge>Skipped</Badge>}
              </div>
              <ol className="relative flex max-h-[420px] flex-col gap-3 overflow-auto text-[13px] before:absolute before:bottom-2 before:left-[47px] before:top-2 before:w-px before:bg-line">
                {events.map((e) => (
                  <li key={e.id} className="relative flex gap-3">
                    <span className="mono w-10 flex-none pt-px text-[11px] text-muted">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>
                    <span className="relative z-10 mt-1.5 h-[7px] w-[7px] flex-none rounded-full bg-ink" />
                    <span className="min-w-0 break-words text-ink-2"><b className="mono text-[11px] font-semibold tracking-[.06em] text-ink">{e.kind}</b> {e.text}</span>
                  </li>
                ))}
              </ol>
              {job.status === "failed" && <a className="btn btn-outline" href={job.apply_url || job.url} target="_blank" rel="noreferrer">Finish manually ↗</a>}
              {job.agent_result && !busy && <details className="text-[13px] text-ink-2"><summary className="cursor-pointer font-semibold">Agent&apos;s report</summary><pre className="mt-2 whitespace-pre-wrap font-sans">{job.agent_result}</pre></details>}
            </section>
          )}
        </aside>
      </main>
      {prepared && !decided && (
        <div className="sticky bottom-0 z-30 border-t border-ink bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <a href="#approve" className="btn btn-primary w-full">Review answers and approve ↓</a>
        </div>
      )}
    </div>
  );
}

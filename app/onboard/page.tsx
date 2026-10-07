import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { AppHeader } from "@/components/ui";
import { Submit } from "@/components/submit";
import { Info } from "@/components/info";
import { connectGmailAction, loadDemoResume, startAutopilot } from "@/app/actions";
import { GmailStatus } from "./gmail";
import { FactsForm, UploadForm } from "./forms";

type Status = "done" | "todo" | "optional";

function StepCard({ id, n, title, status, desc, info, children }: { id: string; n: number; title: string; status: Status; desc: string; info: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-6 overflow-visible">
      <div className="flex items-start gap-4 border-b border-line px-5 py-5 sm:px-6">
        <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-semibold ${status === "done" ? "bg-accent text-white" : "border border-line bg-bg text-ink-2"}`}>
          {status === "done" ? "✓" : n}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold">{title}</h2>
            <Info label={`About ${title}`}>{info}</Info>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${status === "done" ? "bg-accent-soft text-accent-ink" : status === "optional" ? "bg-soft text-muted" : "bg-warn-soft text-warn-ink"}`}>
              {status === "done" ? "Done" : status === "optional" ? "Optional" : "To do"}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-muted">{desc}</p>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function ResumeSummary({ r }: { r: any }) {
  const src = r.source || {};
  const lines = (r.summary ? 1 : 0) + (r.experience || []).reduce((n: number, e: any) => n + e.bullets.length, 0) + (r.projects || []).reduce((n: number, p: any) => n + p.bullets.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-bg p-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[17px] font-semibold capitalize">{String(r.name || "").toLowerCase()}</span>
          <span className="text-[14px] text-ink-2">{r.title}{r.contact?.location ? ` · ${r.contact.location}` : ""}</span>
        </div>
        <span className="max-w-full truncate rounded-full bg-card px-2.5 py-1 text-[12px] font-medium text-muted ring-1 ring-line">
          {src.kind === "pdf" ? `From ${src.file}` : src.kind === "demo" || !src.kind ? "Demo resume" : ""}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[["Roles", (r.experience || []).length], ["Projects", (r.projects || []).length], ["Skills", (r.skills || []).length]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-soft px-2 py-3"><dt className="text-[12px] text-muted">{k}</dt><dd className="text-[22px] font-bold">{v}</dd></div>
        ))}
      </dl>
      {src.check && (
        <p className={`rounded-lg px-3 py-2 text-[14px] ${src.check.dropped?.length ? "bg-warn-soft text-warn-ink" : "bg-accent-soft text-accent-ink"}`}>
          {src.check.dropped?.length
            ? `${src.check.matched} of ${src.check.total} lines matched your PDF word-for-word. ${src.check.dropped.length} reworded line(s) were left out, so the agent never treats them as facts.`
            : `✓ All ${src.check.total} lines matched your PDF word-for-word. The agent will only ever use these.`}
        </p>
      )}
      <details className="group rounded-xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold">
          What your agent will use ({lines} lines)
          <span className="text-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-line px-4 py-4 text-[14px]">
          {r.summary?.text && <div><b>Summary</b><p className="mt-1 text-ink-2">{r.summary.text}</p></div>}
          {(r.experience || []).map((e: any) => (
            <div key={e.id}><b>{e.role}</b> <span className="text-muted">· {e.company}</span>
              <ul className="mt-1 flex flex-col gap-1 text-ink-2">{e.bullets.map((b: any) => <li key={b.id} className="flex gap-2"><span className="text-accent">•</span>{b.text}</li>)}</ul>
            </div>
          ))}
          {(r.projects || []).map((p: any) => (
            <div key={p.id}><b>{p.name}</b> <span className="text-muted">· {p.tagline}</span>
              <ul className="mt-1 flex flex-col gap-1 text-ink-2">{p.bullets.map((b: any) => <li key={b.id} className="flex gap-2"><span className="text-accent">•</span>{b.text}</li>)}</ul>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">{(r.skills || []).map((s: string) => <span key={s} className="rounded-md bg-soft px-2 py-0.5 text-[13px] text-ink-2">{s}</span>)}</div>
        </div>
      </details>
    </div>
  );
}

export default async function Onboard() {
  const u = await currentUser();
  if (!u) redirect("/signin");
  const r = u.resume;
  const f = r?.application_facts || {};
  const steps: { id: string; title: string; status: Status }[] = [
    { id: "resume", title: "Your resume", status: r ? "done" : "todo" },
    { id: "details", title: "Application details", status: r && u.email && f.country_of_residence ? "done" : "todo" },
    { id: "gmail", title: "Connect Gmail", status: u.gmail_active ? "done" : "todo" },
  ];
  const done = steps.filter((s) => s.status === "done").length;
  const autopilotOn = Boolean((u as any).autopilot?.enabled);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader user={u} active="onboard" />
      <main className="mx-auto grid max-w-[1080px] gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[240px_1fr] lg:py-10">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Set up your agent</h1>
            <p className="text-[14px] leading-relaxed text-muted">About 2 minutes. Your agent only ever uses what you put here.</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px] font-medium text-ink-2"><span>Progress</span><span>{done} of 3</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / 3) * 100}%` }} /></div>
          </div>
          <nav aria-label="Setup steps" className="flex flex-wrap gap-x-1 gap-y-1 lg:flex-col">
            {steps.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="flex flex-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-ink-2 no-underline hover:bg-soft">
                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-semibold ${s.status === "done" ? "bg-accent text-white" : "border border-line bg-card"}`}>{s.status === "done" ? "✓" : i + 1}</span>
                {s.title}
              </a>
            ))}
          </nav>
          {autopilotOn && <Link href="/dashboard" className="btn btn-ghost hidden lg:inline-flex">Go to dashboard →</Link>}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <StepCard id="resume" n={1} title="Your resume" status={steps[0].status}
            desc="Upload the resume you already use. Every tailored version is built only from lines in it."
            info="We read the text in your PDF and copy each line exactly. When the agent tailors your resume for a job, code checks that every line it writes comes from one of these. If it isn't here, it can't appear on an application.">
            {r ? (
              <div className="flex flex-col gap-5">
                <ResumeSummary r={r} />
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-medium text-muted">Have a newer version?</span>
                  <UploadForm compact />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <UploadForm />
                <form action={loadDemoResume} className="flex flex-wrap items-center justify-center gap-2 text-[14px] text-muted">
                  No resume handy?
                  <Submit className="font-semibold text-accent underline-offset-2 hover:underline" pending="Loading…">Use the demo resume</Submit>
                </form>
              </div>
            )}
          </StepCard>

          <StepCard id="details" n={2} title="Application details" status={steps[1].status}
            desc="The facts application forms ask for. Blank answers are never guessed; the agent asks you instead."
            info="Application forms ask the same questions every time: where you live, sponsorship, start date, links. Your agent fills them from here. Anything blank shows up as “needs you” on the approval page.">
            <FactsForm d={{
              target_role: (u as any).target_role || "", title_hint: r?.title?.split(/[|,·]/)[0]?.trim(),
              email: u.email || r?.contact?.email || "", country_of_residence: f.country_of_residence,
              visa: f.requires_visa_sponsorship == null ? "" : f.requires_visa_sponsorship ? "yes" : "no",
              notice_period: f.notice_period || "", workplace: f.workplace || "any", linkedin_url: f.linkedin_url || "", portfolio_url: f.portfolio_url || r?.contact?.github || "",
            }} />
          </StepCard>

          <StepCard id="gmail" n={3} title="Connect Gmail" status={steps[2].status}
            desc="So your agent can ask for approval before applying and confirm when it's done."
            info="Connecting gives your private agent computer (on Agent37) permission to send email from your Gmail. It only ever emails you: approval requests and “Applied” confirmations. You can disconnect any time.">
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
                <li className="flex gap-2"><span className="text-accent">✓</span>Approval requests with a “Review and approve” button</li>
                <li className="flex gap-2"><span className="text-accent">✓</span>“Applied” confirmations with your outreach note</li>
                <li className="flex gap-2"><span className="text-accent">✓</span>Only ever sent to you, from your own inbox</li>
              </ul>
              <div className="flex flex-wrap items-center gap-4">
                {!u.gmail_active && <form action={connectGmailAction}><Submit pending="Opening Google…">Connect Gmail</Submit></form>}
                <GmailStatus initial={Boolean(u.gmail_active)} hasInstance={Boolean(u.agent37_instance_id)} />
              </div>
              {u.agent37_instance_id && (
                <p className="flex items-center gap-2 text-[13px] text-muted">
                  <span className="h-2 w-2 rounded-full bg-accent" />Private agent computer ready · sleeps when idle
                </p>
              )}
            </div>
          </StepCard>

          <section className={`card overflow-hidden ${r ? "card-hot" : ""}`}>
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="text-[22px]" aria-hidden="true">🚀</span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[19px] font-semibold">{autopilotOn ? "Autopilot is on" : "Start your automatic job search"}</h2>
                  <p className="text-[14px] leading-relaxed text-ink-2">
                    Your agent searches every day at 8:00 AM (Lagos time), keeps only jobs open to you, prepares the best {3} with a tailored resume and a note
                    for the hiring contact, and <b>emails you to approve</b>. You don&apos;t need to keep this site open.
                  </p>
                </div>
              </div>
              <ol className="grid gap-2 text-[13px] text-ink-2 sm:grid-cols-4">
                {["Search & filter", "Score & pick top 3", "Tailor + find contact", "Email you to approve"].map((t, i) => (
                  <li key={t} className="flex items-center gap-2 rounded-lg bg-soft px-3 py-2"><span className="font-mono text-accent">{i + 1}</span>{t}</li>
                ))}
              </ol>
              {!u.gmail_active && r && (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn-ink">Without Gmail, matches still get prepared but only show on your dashboard. Connect it above to get them by email.</p>
              )}
              {autopilotOn ? (
                <Link href="/dashboard" className="btn btn-primary self-start">Go to dashboard →</Link>
              ) : (
                <form action={startAutopilot}>
                  <Submit disabled={!r} pending="Starting your agent…">Start automatic job search</Submit>
                  {!r && <span className="ml-3 text-[13px] text-muted">Add your resume first</span>}
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

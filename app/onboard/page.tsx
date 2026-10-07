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
    <section id={id} className="enter card scroll-mt-24 overflow-visible" style={{ ["--i" as string]: n }}>
      <div className="flex items-start gap-4 border-b border-line px-5 py-5 sm:gap-5 sm:px-7 sm:py-6">
        <span className={`display flex h-12 w-12 flex-none items-center justify-center rounded-full text-[24px] leading-none ${status === "done" ? "bg-go text-ink" : "border border-ink text-ink"}`}>
          {status === "done" ? "✓" : n}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="serif text-[24px] leading-tight">{title}</h2>
            <Info label={`About ${title}`}>{info}</Info>
            <span className={`tag ml-auto ${status === "done" ? "bg-go text-ink" : status === "optional" ? "bg-soft text-muted" : "bg-warn-soft text-warn-ink"}`}>
              {status === "done" ? "Done" : status === "optional" ? "Optional" : "To do"}
            </span>
          </div>
          <p className="text-[14px] leading-relaxed text-muted">{desc}</p>
        </div>
      </div>
      <div className="px-5 py-6 sm:px-7">{children}</div>
    </section>
  );
}

function ResumeSummary({ r }: { r: any }) {
  const src = r.source || {};
  const lines = (r.summary ? 1 : 0) + (r.experience || []).reduce((n: number, e: any) => n + e.bullets.length, 0) + (r.projects || []).reduce((n: number, p: any) => n + p.bullets.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[12px] border border-ink bg-paper p-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="serif text-[22px] capitalize">{String(r.name || "").toLowerCase()}</span>
          <span className="text-[14px] text-ink-2">{r.title}{r.contact?.location ? ` · ${r.contact.location}` : ""}</span>
        </div>
        <span className="tag max-w-full truncate bg-card text-muted ring-1 ring-line">
          {src.kind === "pdf" ? `From ${src.file}` : src.kind === "demo" || !src.kind ? "Demo resume" : ""}
        </span>
      </div>
      <dl className="grid grid-cols-3 overflow-hidden rounded-[12px] border border-line text-center">
        {[["Roles", (r.experience || []).length], ["Projects", (r.projects || []).length], ["Skills", (r.skills || []).length]].map(([k, v]) => (
          <div key={k as string} className="border-l border-line px-2 py-3 first:border-l-0"><dt className="mono text-[11px] uppercase tracking-[.1em] text-muted">{k}</dt><dd className="display text-[34px] leading-tight">{v}</dd></div>
        ))}
      </dl>
      {src.check && (
        <p className={`rounded-[10px] px-3 py-2.5 text-[14px] ${src.check.dropped?.length ? "bg-warn-soft text-warn-ink" : "bg-go text-ink"}`}>
          {src.check.dropped?.length
            ? `${src.check.matched} of ${src.check.total} lines matched your PDF word-for-word. ${src.check.dropped.length} reworded line(s) were left out, so the agent never treats them as facts.`
            : `✓ All ${src.check.total} lines matched your PDF word-for-word. The agent will only ever use these.`}
        </p>
      )}
      <details className="group rounded-[12px] border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold">
          What your agent will use ({lines} lines)
          <span className="text-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-line px-4 py-4 text-[14px]">
          {r.summary?.text && <div><b>Summary</b><p className="mt-1 text-ink-2">{r.summary.text}</p></div>}
          {(r.experience || []).map((e: any) => (
            <div key={e.id}><b>{e.role}</b> <span className="text-muted">· {e.company}</span>
              <ul className="mt-1 flex flex-col gap-1 text-ink-2">{e.bullets.map((b: any) => <li key={b.id} className="flex gap-2"><span className="text-signal-ink">•</span>{b.text}</li>)}</ul>
            </div>
          ))}
          {(r.projects || []).map((p: any) => (
            <div key={p.id}><b>{p.name}</b> <span className="text-muted">· {p.tagline}</span>
              <ul className="mt-1 flex flex-col gap-1 text-ink-2">{p.bullets.map((b: any) => <li key={b.id} className="flex gap-2"><span className="text-signal-ink">•</span>{b.text}</li>)}</ul>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">{(r.skills || []).map((s: string) => <span key={s} className="rounded-[6px] border border-line bg-paper px-2 py-0.5 text-[13px] text-ink-2">{s}</span>)}</div>
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
    <div className="min-h-screen">
      <AppHeader user={u} active="onboard" />
      <main className="mx-auto grid max-w-[1140px] gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[260px_1fr] lg:py-14">
        <aside className="enter flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Profile</span>
            <h1 className="display text-[42px] leading-[1]">Set up your <em>agent.</em></h1>
            <p className="text-[14px] leading-relaxed text-muted">About 2 minutes. Your agent only ever uses what you put here.</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="mono flex justify-between text-[11px] uppercase tracking-[.1em] text-ink-2"><span>Progress</span><span>{done} of 3</span></div>
            <div className="h-2 overflow-hidden rounded-full border border-ink bg-card"><div className="h-full bg-go transition-all duration-700" style={{ width: `${(done / 3) * 100}%` }} /></div>
          </div>
          <nav aria-label="Setup steps" className="flex flex-wrap gap-1 lg:flex-col">
            {steps.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="flex flex-none items-center gap-3 rounded-[10px] px-2.5 py-2 text-[14px] text-ink-2 no-underline transition-colors hover:bg-card hover:text-ink">
                <span className={`mono flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] ${s.status === "done" ? "bg-go text-ink" : "border border-ink"}`}>{s.status === "done" ? "✓" : i + 1}</span>
                {s.title}
              </a>
            ))}
          </nav>
          {autopilotOn && <Link href="/dashboard" className="btn btn-outline btn-sm hidden self-start lg:inline-flex">Go to dashboard <span className="arr" aria-hidden="true">→</span></Link>}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <StepCard id="resume" n={1} title="Your resume" status={steps[0].status}
            desc="Upload the resume you already use. Every tailored version is built only from lines in it."
            info="We read the text in your PDF and copy each line exactly. When the agent tailors your resume for a job, code checks that every line it writes comes from one of these. If it isn't here, it can't appear on an application.">
            {r ? (
              <div className="flex flex-col gap-5">
                <ResumeSummary r={r} />
                <div className="flex flex-col gap-2">
                  <span className="mono text-[11px] uppercase tracking-[.1em] text-muted">Have a newer version?</span>
                  <UploadForm compact />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <UploadForm />
                <form action={loadDemoResume} className="flex flex-wrap items-center justify-center gap-2 text-[14px] text-muted">
                  No resume handy?
                  <Submit className="font-semibold text-ink underline underline-offset-4 hover:text-signal-ink" pending="Loading…">Use the demo resume</Submit>
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
            <div className="flex flex-col gap-5">
              <ul className="flex flex-col gap-2.5 text-[15px] text-ink-2">
                <li className="flex gap-3"><span className="text-go-ink">✓</span>Approval requests with a “Review and approve” button</li>
                <li className="flex gap-3"><span className="text-go-ink">✓</span>“Applied” confirmations with your outreach note</li>
                <li className="flex gap-3"><span className="text-go-ink">✓</span>Only ever sent to you, from your own inbox</li>
              </ul>
              <div className="flex flex-wrap items-center gap-4">
                {!u.gmail_active && <form action={connectGmailAction}><Submit pending="Opening Google…">Connect Gmail <span className="arr" aria-hidden="true">→</span></Submit></form>}
                <GmailStatus initial={Boolean(u.gmail_active)} hasInstance={Boolean(u.agent37_instance_id)} />
              </div>
              {u.agent37_instance_id && (
                <p className="mono flex items-center gap-2.5 text-[11px] uppercase tracking-[.08em] text-muted">
                  <span className="live live-go" />Private agent computer ready · sleeps when idle
                </p>
              )}
            </div>
          </StepCard>

          <section className={`enter overflow-hidden rounded-[14px] ${r ? "card-hot bg-ink text-paper" : "border border-dashed border-ink/40"}`} style={{ ["--i" as string]: 4 }}>
            <div className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-3">
                <span className={`mono text-[11px] uppercase tracking-[.1em] ${r ? "text-go" : "text-muted"}`}>{autopilotOn ? "Running" : "Last step"}</span>
                <h2 className="display text-[38px] leading-[1] sm:text-[46px]">{autopilotOn ? <>Autopilot is <em>on.</em></> : <>Start your automatic <em>job search.</em></>}</h2>
                <p className={`max-w-[620px] text-[15px] leading-relaxed ${r ? "text-paper/75" : "text-ink-2"}`}>
                  Your agent searches every day at 8:00 AM (Lagos time), keeps only jobs open to you, prepares the best 3 with a tailored resume and a note
                  for the hiring contact, and <b className={r ? "text-paper" : ""}>emails you to approve</b>. You don&apos;t need to keep this site open.
                </p>
              </div>
              <ol className={`grid gap-px overflow-hidden rounded-[10px] text-[13px] sm:grid-cols-4 ${r ? "bg-paper/15" : "bg-line"}`}>
                {["Search and filter", "Score, pick top 3", "Tailor, find contact", "Email you to approve"].map((t, i) => (
                  <li key={t} className={`flex items-center gap-2.5 px-3.5 py-3 ${r ? "bg-ink" : "bg-paper"}`}><span className={`mono ${r ? "text-go" : "text-signal-ink"}`}>0{i + 1}</span>{t}</li>
                ))}
              </ol>
              {!u.gmail_active && r && (
                <p className="rounded-[10px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn-ink">Without Gmail, matches still get prepared but only show on your dashboard. Connect it above to get them by email.</p>
              )}
              {autopilotOn ? (
                <Link href="/dashboard" className="btn self-start bg-go text-ink hover:bg-paper">Go to dashboard <span className="arr" aria-hidden="true">→</span></Link>
              ) : (
                <form action={startAutopilot} className="flex flex-wrap items-center gap-3">
                  <Submit className="btn bg-go text-ink hover:bg-paper disabled:bg-soft disabled:text-muted" disabled={!r} pending="Starting your agent…">Start automatic job search <span className="arr" aria-hidden="true">→</span></Submit>
                  {!r && <span className="text-[13px] text-muted">Add your resume first</span>}
                </form>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/ui";
import { CountUp, ScanReplay, type ScanRow } from "@/components/motion";

// Rendered per request so a CDN in front of the app never keeps an old copy after a deploy.
export const dynamic = "force-dynamic";

// Real postings from our Oct 7, 2026 test search (location text as listed).
const scan: ScanRow[] = [
  { company: "LiveKit", title: "Security Engineer", where: "United States (Remote) · Canada (Remote)", open: false, why: "US + Canada" },
  { company: "Supabase", title: "Support Engineer (AMER)", where: "Remote, AMER", open: false, why: "Americas only" },
  { company: "PostHog", title: "AI Research Engineer", where: "Hybrid (UK)", open: false, why: "UK only" },
  { company: "Canonical", title: "Web Developer", where: "Home based - EMEA", open: true, why: "Open to you" },
  { company: "LiveKit", title: "GTM Systems Engineer", where: "North America (Remote)", open: false, why: "N. America" },
  { company: "Canonical", title: "Cloud Support Engineer", where: "Office Based - London, UK", open: false, why: "London office" },
  { company: "Supabase", title: "Support Engineer (APAC)", where: "Remote, APAC", open: false, why: "APAC only" },
  { company: "MetaMask", title: "Senior Software Engineer, Predict", where: "Remote, listed for Nigeria on LinkedIn", open: true, why: "Open to you" },
  { company: "PostHog", title: "Site Reliability Engineer", where: "San Francisco, CA · Remote (US)", open: false, why: "US only" },
  { company: "LiveKit", title: "Developer Success Engineer", where: "Ireland (Remote)", open: false, why: "Ireland only" },
  { company: "Canonical", title: "Python Engineer", where: "Home based - Worldwide", open: true, why: "Open to you" },
  { company: "Supabase", title: "Developer Relations Engineer", where: "Remote, London UK", open: false, why: "UK only" },
  { company: "Canonical", title: "MAAS Infrastructure Engineer", where: "Office Based - Toronto, Canada", open: false, why: "Toronto office" },
  { company: "Canonical", title: "Software Engineer, Edge AI", where: "Home based - EMEA", open: true, why: "Open to you" },
];

const finePrint = [
  "United States (Remote)", "Remote, AMER", "Hybrid (UK)", "North America (Remote)", "Office Based - London, UK", "Remote, APAC",
  "Remote (US)", "Home Based - Americas", "San Francisco, CA (Hybrid)", "Remote, US West", "Ireland (Remote)", "Remote, New York, US",
  "Office Based - Toronto, Canada", "Home Based - APAC", "United Kingdom (Remote)", "Remote, San Francisco, CA",
];

const plans = [
  { name: "Free", price: "$0", per: "forever", items: ["5 matched jobs a week", "Tailored resume download", "You apply yourself"] },
  { name: "Pro", price: "$19", per: "a month", items: ["Daily autopilot search", "Up to 30 applications a month", "Hiring contact and outreach drafts", "Approve from your inbox"], hot: true },
  { name: "Pay as you go", price: "$0.50", per: "an application", items: ["For occasional searches", "Everything in Pro, per application"] },
];

function Arrow() {
  return <span className="arr" aria-hidden="true">→</span>;
}

function Marquee({ items, rev, dur }: { items: string[]; rev?: boolean; dur: string }) {
  const row = items.map((t, i) => (
    <span key={i} className="flex items-center gap-6 pr-6">
      <span className="strike mono whitespace-nowrap text-[15px] text-paper/80 sm:text-[17px]">{t}</span>
      <span className="text-signal" aria-hidden="true">✕</span>
    </span>
  ));
  return (
    <div className="marquee-wrap overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]" aria-hidden="true">
      <div className={`marquee ${rev ? "marquee-rev" : ""}`} style={{ ["--dur" as string]: dur }}>{row}{row}</div>
    </div>
  );
}

function StepArtifact({ n }: { n: number }) {
  if (n === 0) return (
    <ul className="card flex flex-col divide-y divide-line text-[14px]">
      {scan.slice(0, 4).map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 flex-col">
            <span className="mono text-[11px] uppercase tracking-[.08em] text-muted">{r.company}</span>
            <span className={`truncate font-semibold ${r.open ? "" : "text-ink-2"}`}><span className={r.open ? "hl hl-draw" : "strike strike-draw"}>{r.title}</span></span>
          </span>
          <span className={`stamp ${r.open ? "text-go-ink" : "text-signal"}`}>{r.why}</span>
        </li>
      ))}
    </ul>
  );
  if (n === 1) return (
    <div className="card flex flex-col gap-0 overflow-hidden text-[14px]">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="mono text-[11px] uppercase tracking-[.1em] text-muted">Tailored resume · example</span>
        <span className="tag bg-go text-ink">✓ every line cited</span>
      </div>
      {[
        ["Built a background job runner in TypeScript that retries failed tasks.", "exp-2 · b3"],
        ["Shipped the billing page every customer uses to manage their plan.", "proj-1 · b1"],
      ].map(([t, s]) => (
        <p key={s} className="flex flex-col gap-1.5 border-b border-line px-4 py-3 leading-relaxed">
          {t}<span className="mono self-start rounded bg-soft px-1.5 py-0.5 text-[11px] text-ink-2">↳ cites {s}</span>
        </p>
      ))}
      <p className="flex flex-col gap-1.5 bg-signal-soft/50 px-4 py-3 leading-relaxed text-ink-2">
        <span><span className="strike strike-draw">Led a team of 20 engineers.</span></span>
        <span className="stamp self-start text-signal">Removed: not on your resume</span>
      </p>
    </div>
  );
  if (n === 2) return (
    <div className="card flex flex-col gap-4 p-4 text-[14px]">
      <div className="flex items-center gap-3">
        <span className="display flex h-11 w-11 items-center justify-center rounded-[10px] bg-ink text-[18px] text-paper">EM</span>
        <span className="flex flex-col">
          <span className="font-semibold">Engineering manager</span>
          <span className="text-muted">Canonical · LinkedIn profile ↗</span>
        </span>
      </div>
      <p className="serif border-l-2 border-signal pl-3 text-[16px] italic leading-relaxed text-ink-2">
        “Hi, I just applied for the Web Developer role. I&apos;ve shipped the same kind of customer-facing pages your team owns, and I&apos;d love to talk.”
      </p>
      <span className="mono text-[11px] uppercase tracking-[.1em] text-muted">Drafted for you · you send it</span>
    </div>
  );
  return (
    <div className="card overflow-hidden text-[14px]">
      <div className="flex flex-col gap-0.5 border-b border-line px-4 py-3">
        <span className="mono text-[11px] uppercase tracking-[.1em] text-muted">Inbox · from your own Gmail</span>
        <span className="font-semibold">2 jobs ready for your OK</span>
      </div>
      {[["Canonical", "Web Developer", 85], ["MetaMask", "Senior Software Engineer", 90]].map(([c, t, s]) => (
        <div key={c} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="flex min-w-0 flex-col"><span className="truncate font-semibold">{t}</span><span className="text-muted">{c} · {s} fit</span></span>
          <span className="btn btn-primary btn-sm pointer-events-none">Approve</span>
        </div>
      ))}
      <div className="flex items-center gap-2 bg-go/60 px-4 py-3 font-semibold">✓ Applied: Canonical, Web Developer</div>
    </div>
  );
}

const steps = [
  { t: "Find jobs you can take", d: "Searches LinkedIn and company careers pages, reads where each role is really open, and hides every one closed to where you live." },
  { t: "Tailor your resume, honestly", d: "Rewrites your resume for each job using only lines from your real one. Code, not the AI, checks every line cites a source. Anything it can't back up is removed." },
  { t: "Find the person hiring", d: "Looks up the recruiter or engineering manager and drafts a short, specific note. You send it. The agent never emails strangers." },
  { t: "Ask, then apply", d: "Emails you the day's best matches. Tap Approve and your private agent fills the form in its own browser, then tells you it's done." },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <div className="bg-ink px-4 py-2 text-center text-[13px] text-paper">
        <span className="mono mr-2 text-[11px] uppercase tracking-[.1em] text-go">Early access</span>Every account gets Pro, free. No card needed.
      </div>

      <header className="sticky top-0 z-40 border-b border-ink/15 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Logo size={26} />
          <nav className="hidden items-center gap-8 text-[15px] text-ink-2 md:flex">
            <a href="#how" className="no-underline hover:text-ink">How it works</a>
            <a href="#promises" className="no-underline hover:text-ink">Promises</a>
            <a href="#pricing" className="no-underline hover:text-ink">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/signin" className="hidden text-[15px] font-medium text-ink-2 no-underline hover:text-ink sm:inline">Sign in</Link>
            <Link href="/signin" className="btn btn-primary btn-sm">Start your search <Arrow /></Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1240px] items-start gap-12 px-4 pb-20 pt-12 sm:px-8 sm:pt-20 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)] lg:gap-16 lg:pb-28">
          <div className="flex flex-col gap-8">
            <span className="eyebrow enter">For engineers outside the US and EU</span>
            <h1 className="display enter text-[60px] leading-[.92] sm:text-[92px] lg:text-[104px]" style={{ ["--i" as string]: 1 }}>
              “Remote,” <em className="text-signal">except</em> where you&nbsp;live.
            </h1>
            <p className="enter max-w-[560px] text-[18px] leading-relaxed text-ink-2 sm:text-[19px]" style={{ ["--i" as string]: 2 }}>
              Ocus AI is a job-search agent that reads the fine print on every posting, keeps <span className="hl">only the jobs you can legally take</span>,
              tailors your resume without inventing a line, and applies once you say yes.
            </p>
            <div className="enter flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 3 }}>
              <Link href="/signin" className="btn btn-primary">Start your search <Arrow /></Link>
              <a href="#how" className="btn btn-outline">See how it works</a>
            </div>
            <ul className="enter mono flex flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[.08em] text-muted" style={{ ["--i" as string]: 4 }}>
              <li>✓ Pro free in early access</li><li>✓ Nothing sent without your OK</li><li>✓ Your own agent computer</li>
            </ul>
          </div>
          <div className="enter lg:mt-4" style={{ ["--i" as string]: 3 }}>
            <ScanReplay rows={scan} total={518} open={4} />
          </div>
        </section>

        {/* The fine print */}
        <section className="relative overflow-hidden bg-ink py-20 text-paper sm:py-28">
          <div className="mx-auto grid max-w-[1240px] items-end gap-10 px-4 sm:px-8 lg:grid-cols-[auto_1fr] lg:gap-16">
            <div data-reveal className="display text-[132px] leading-[.8] text-signal sm:text-[220px]"><CountUp value={514} ms={1800} /></div>
            <div data-reveal style={{ ["--i" as string]: 1 }} className="flex max-w-[560px] flex-col gap-5 pb-2">
              <span className="mono text-[12px] uppercase tracking-[.1em] text-paper/60">Of 518 “remote” jobs in our test search</span>
              <p className="serif text-[28px] leading-[1.2] sm:text-[36px]">were closed to someone living in Nigeria. You only find that out one posting at a time.</p>
              <p className="text-[16px] leading-relaxed text-paper/70">Ocus AI reads it for you, every morning, and shows you the four that are actually open.</p>
            </div>
          </div>
          <div className="mt-16 flex flex-col gap-4 sm:mt-20">
            <Marquee items={finePrint} dur="70s" />
            <Marquee items={[...finePrint].reverse()} rev dur="80s" />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto grid max-w-[1240px] scroll-mt-20 gap-12 px-4 py-20 sm:px-8 sm:py-28 grid-cols-[minmax(0,1fr)] lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-20">
          <div className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
            <span className="eyebrow">How it works</span>
            <h2 className="display text-[48px] leading-[.98] sm:text-[60px]">One round, every morning at <em>8:00.</em></h2>
            <p className="max-w-[380px] text-[16px] leading-relaxed text-ink-2">
              Your agent runs on its own private computer. It works while you sleep and you act from your inbox. You never have to keep this site open.
            </p>
            <Link href="/signin" className="btn btn-primary mt-2 self-start">Start your search <Arrow /></Link>
          </div>
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.t} data-reveal className="grid grid-cols-[minmax(0,1fr)] gap-6 border-t border-ink py-10 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10">
                <div className="flex flex-col gap-3">
                  <span className="mono text-[13px] text-signal-ink">0{i + 1}</span>
                  <h3 className="serif text-[30px] leading-[1.1]">{s.t}</h3>
                  <p className="text-[16px] leading-relaxed text-ink-2">{s.d}</p>
                </div>
                <StepArtifact n={i} />
              </li>
            ))}
          </ol>
        </section>

        {/* Promises */}
        <section id="promises" className="scroll-mt-20 border-y border-ink bg-card">
          <div className="mx-auto grid max-w-[1240px] md:grid-cols-3">
            {[
              ["Nothing invented.", "Every resume line cites a line from your real resume. Code checks it, not the AI. Your uploaded PDF is matched word for word."],
              ["Nothing sent without you.", "The agent applies only after you tap Approve. Outreach notes are drafts; you send them yourself."],
              ["Nothing you can’t take.", "Jobs closed to where you live are hidden before you see them. Seniority is never hard-filtered, just labelled."],
            ].map(([h, d], i) => (
              <div key={h} data-reveal style={{ ["--i" as string]: i }} className={`flex flex-col gap-4 px-4 py-12 sm:px-8 sm:py-16 ${i ? "border-t border-ink md:border-l md:border-t-0" : ""}`}>
                <span className="mono text-[12px] uppercase tracking-[.1em] text-muted">Promise 0{i + 1}</span>
                <h3 className="display text-[40px] leading-[1] sm:text-[46px]">{h}</h3>
                <p className="text-[16px] leading-relaxed text-ink-2">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto flex max-w-[1240px] scroll-mt-20 flex-col gap-10 px-4 py-20 sm:px-8 sm:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-4">
              <span className="eyebrow">Pricing</span>
              <h2 className="display text-[48px] leading-[.98] sm:text-[60px]">Your own agent, <em>its own computer.</em></h2>
              <p className="max-w-[520px] text-[16px] leading-relaxed text-ink-2">Each account gets a private agent computer that sleeps when idle. Paid plans are coming soon.</p>
            </div>
            <div data-reveal className="flex max-w-[400px] -rotate-1 flex-col gap-1 rounded-[14px] bg-go px-6 py-5 card-hot">
              <span className="mono text-[11px] uppercase tracking-[.1em]">Early access</span>
              <span className="serif text-[22px] leading-snug">Every account gets Pro, free. No card needed.</span>
            </div>
          </div>
          <div className="grid overflow-hidden rounded-[14px] border border-ink md:grid-cols-3">
            {plans.map((p, i) => (
              <div key={p.name} data-reveal style={{ ["--i" as string]: i }}
                className={`flex flex-col gap-5 p-7 sm:p-8 ${p.hot ? "bg-ink text-paper" : "bg-card"} ${i ? "border-t border-ink md:border-l md:border-t-0" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="mono text-[13px] uppercase tracking-[.1em]">{p.name}</h3>
                  {p.hot ? <span className="tag bg-go text-ink">Free in early access</span> : <span className="soon">Coming soon</span>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="display text-[64px] leading-none">{p.price}</span>
                  <span className={`text-[15px] ${p.hot ? "text-paper/70" : "text-muted"}`}>{p.per}</span>
                </div>
                <ul className={`flex flex-col gap-2.5 border-t pt-5 text-[15px] ${p.hot ? "border-paper/20 text-paper/90" : "border-line text-ink-2"}`}>
                  {p.items.map((it) => <li key={it} className="flex gap-2.5"><span className={p.hot ? "text-go" : "text-signal-ink"}>✓</span>{it}</li>)}
                </ul>
                {p.hot
                  ? <Link href="/signin" className="btn mt-auto bg-paper text-ink hover:bg-go">Start free with Pro <Arrow /></Link>
                  : <button className="btn btn-ghost mt-auto" disabled>Choose {p.name}</button>}
              </div>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="bg-signal px-4 py-20 text-ink sm:px-8 sm:py-28">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-8">
            <h2 data-reveal className="display max-w-[960px] text-[54px] leading-[.95] sm:text-[96px]">Let the agent read the <em>fine print.</em></h2>
            <div data-reveal style={{ ["--i" as string]: 1 }} className="flex flex-wrap items-center gap-4">
              <Link href="/signin" className="btn bg-ink text-paper hover:bg-paper hover:text-ink">Start your search <Arrow /></Link>
              <span className="text-[15px]">About two minutes to set up. Upload your resume and go.</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="overflow-hidden bg-ink text-paper">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 pt-10 text-[14px] text-paper/70 sm:px-8">
          <span>Built at the Build an Agent hackathon, Oct 2026</span>
          <span className="mono text-[12px] uppercase tracking-[.1em]">Agent37 · Monid · InstaCloud · OpenAI</span>
        </div>
        <div className="display select-none px-2 text-center text-[29vw] leading-[.78] text-paper/[.07]" aria-hidden="true">Ocus AI</div>
      </footer>
    </div>
  );
}

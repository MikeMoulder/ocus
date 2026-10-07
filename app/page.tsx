import Link from "next/link";
import { Logo } from "@/components/ui";

const steps = [
  { n: "01", t: "Finds jobs you can actually take", d: "Searches LinkedIn and company boards daily, then hides every role that's closed to where you live." },
  { n: "02", t: "Tailors your resume, honestly", d: "Rewrites for each job using only lines from your real resume. Code checks every line cites a source." },
  { n: "03", t: "Finds the person hiring", d: "Looks up the recruiter or engineering manager and drafts a short, specific note for you to send." },
  { n: "04", t: "Asks, then applies", d: "Emails you for approval. Once you approve, your private agent fills the form and submits it in its own browser." },
];

const plans = [
  { name: "Free", price: "$0", per: "", items: ["5 matched jobs a week", "Tailored resume download", "You apply yourself"] },
  { name: "Pro", price: "$19", per: "/mo", items: ["Daily autopilot search", "Up to 30 applications a month", "Hiring contact + outreach drafts", "Gmail approvals"], hot: true },
  { name: "Pay as you go", price: "$0.50", per: "/application", items: ["For occasional searches", "Everything in Pro, per application"] },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <Link href="/signin" className="text-[15px] font-medium text-ink-2 hover:text-ink">Sign in</Link>
          <Link href="/signin" className="btn btn-primary">Start free</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1180px] flex-col gap-20 px-4 pb-24 pt-10 sm:px-8 sm:pt-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-6">
            <span className="eyebrow">For engineers outside the US and EU</span>
            <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[58px]">
              Your job search, on autopilot. <span className="text-accent">Only jobs you can actually get.</span>
            </h1>
            <p className="max-w-[560px] text-[18px] leading-relaxed text-ink-2">
              Ocus AI is an agent with its own cloud computer. It finds roles open to you, tailors your resume without inventing a thing,
              finds who&apos;s hiring, and applies — only after you say yes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signin" className="btn btn-primary">Start free</Link>
              <a href="#how" className="btn btn-ghost">How it works</a>
            </div>
            <p className="text-[14px] text-muted">Early access includes everything in Pro. No card needed.</p>
          </div>
          <div className="card flex flex-col gap-5 p-7">
            <span className="eyebrow">From our test search, Oct 2026</span>
            <div className="flex items-end gap-3">
              <span className="text-[72px] font-bold leading-none tracking-[-0.04em]">514</span>
              <span className="pb-2 text-[18px] text-ink-2">of 518 remote jobs</span>
            </div>
            <p className="text-[17px] leading-relaxed text-ink-2">were <b>not open to someone living in Nigeria</b>. Most of a job search is finding that out, one posting at a time.</p>
            <div className="h-3 overflow-hidden rounded-full bg-soft"><div className="h-full w-[0.8%] min-w-[6px] rounded-full bg-accent" /></div>
            <p className="text-[15px] text-muted">Ocus AI reads the fine print for you and only shows the 4.</p>
          </div>
        </section>

        <section id="how" className="flex flex-col gap-8">
          <h2 className="text-[32px] font-bold tracking-[-0.02em]">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="card flex flex-col gap-3 p-6">
                <span className="font-mono text-[14px] text-accent">{s.n}</span>
                <h3 className="text-[18px] font-semibold leading-snug">{s.t}</h3>
                <p className="text-[15px] leading-relaxed text-ink-2">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Nothing is submitted", "without your Approve click."], ["Nothing is invented:", "every resume line cites your real resume."], ["You send the outreach.", "The agent drafts it; it never spams."]].map(([a, b]) => (
              <p key={a} className="rounded-xl bg-accent-soft px-5 py-4 text-[15px] text-accent-ink"><b>{a}</b> {b}</p>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-[32px] font-bold tracking-[-0.02em]">Pricing</h2>
            <p className="text-[16px] text-ink-2">Each customer gets their own private agent computer, which sleeps when idle.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent px-6 py-5 text-white">
            <div className="flex flex-col gap-0.5">
              <span className="text-[17px] font-semibold">Early access: every account gets Pro, free.</span>
              <span className="text-[14px] text-white/85">Daily autopilot, tailored resumes, hiring contacts and email approvals. No card needed.</span>
            </div>
            <Link href="/signin" className="btn bg-white text-accent hover:bg-accent-soft">Start free with Pro →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.name} className={`card flex flex-col gap-4 p-7 ${p.hot ? "card-hot" : ""}`}>
                <div className="flex items-center justify-between gap-2"><h3 className="text-[18px] font-semibold">{p.name}</h3>{p.hot && <span className="rounded-full bg-accent px-2.5 py-1 text-[12px] font-semibold text-white">Most popular</span>}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[40px] font-bold tracking-[-0.03em]">{p.price}</span>
                  <span className="text-[15px] text-muted">{p.per}</span>
                </div>
                <span className="soon self-start">Coming soon</span>
                <ul className="flex flex-col gap-2 text-[15px] text-ink-2">
                  {p.items.map((i) => <li key={i} className="flex gap-2"><span className="text-accent">✓</span>{i}</li>)}
                </ul>
                <button className="btn btn-ghost mt-auto" disabled>Choose {p.name}</button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line py-8 text-center text-[14px] text-muted">
        Built at the Build an Agent hackathon · Agent37 · Monid · InstaCloud · OpenAI
      </footer>
    </div>
  );
}

import { Logo } from "@/components/ui";
import { SignInForm } from "./form";

// Rendered per request so a CDN in front of the app never keeps an old copy after a deploy.
export const dynamic = "force-dynamic";

const soon = ["Passkey", "Google", "GitHub", "Email link"];
const closed = ["United States (Remote)", "Remote, AMER", "Hybrid (UK)", "North America (Remote)", "Remote, APAC", "Office Based - London, UK"];

export default function SignIn() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex">
        <Logo size={28} light />
        <div className="flex flex-col gap-8">
          <ul className="mono flex flex-col gap-3 text-[17px] text-paper/60" aria-hidden="true">
            {closed.map((c, i) => (
              <li key={c} className="enter flex items-center gap-4" style={{ ["--i" as string]: i + 2 }}>
                <span className="strike strike-anim" style={{ ["--d" as string]: `${0.4 + i * 0.12}s` }}>{c}</span>
                <span className="text-signal">✕</span>
              </li>
            ))}
            <li className="enter flex items-center gap-4 text-paper" style={{ ["--i" as string]: 9 }}>
              <span className="rounded-sm bg-go px-1.5 text-ink">Home based - EMEA</span><span className="text-go">✓ open to you</span>
            </li>
          </ul>
          <p className="display max-w-[520px] text-[44px] leading-[1.02]">Your agent reads the fine print, <em className="text-signal">so you don&apos;t.</em></p>
        </div>
        <span className="mono text-[12px] uppercase tracking-[.1em] text-paper/50">Early access · Pro free · No card</span>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-10 lg:justify-center lg:py-12">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto mt-10 flex w-full max-w-[420px] flex-col gap-7 lg:mt-0">
          <div className="enter flex flex-col gap-3">
            <span className="eyebrow">Demo mode</span>
            <h1 className="display text-[44px] leading-[1]">Sign in to <em>Ocus AI</em></h1>
            <p className="text-[15px] leading-relaxed text-ink-2">Pick any Demo ID and passcode. The first time creates your profile; use the same pair to come back to it.</p>
          </div>
          <div className="enter" style={{ ["--i" as string]: 1 }}><SignInForm /></div>
          <div className="enter flex flex-col gap-3" style={{ ["--i" as string]: 2 }}>
            <div className="mono flex items-center gap-3 text-[11px] uppercase tracking-[.1em] text-muted"><span className="h-px flex-1 bg-line" />Other ways<span className="h-px flex-1 bg-line" /></div>
            <div className="grid grid-cols-2 gap-2">
              {soon.map((s) => (
                <button key={s} disabled className="flex min-h-[46px] cursor-not-allowed items-center justify-between gap-2 rounded-[10px] border border-dashed border-line px-3.5 text-[14px] text-muted">
                  <span>{s}</span><span className="mono text-[10px] uppercase tracking-[.08em]">Soon</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

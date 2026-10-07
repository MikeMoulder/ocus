import { Logo } from "@/components/ui";
import { SignInForm } from "./form";

const soon = ["Passkey", "Google", "GitHub", "Email link"];

export default function SignIn() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-8"><Logo /></header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6">
        <div className="card flex w-full max-w-[440px] flex-col gap-6 p-8">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Demo mode</span>
            <h1 className="text-[28px] font-bold tracking-[-0.02em]">Sign in to Ocus AI</h1>
            <p className="text-[15px] leading-relaxed text-ink-2">Pick any Demo ID and passcode. The first time creates your profile; use the same pair to come back to it.</p>
          </div>
          <SignInForm />
          <div className="flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />other ways<span className="h-px flex-1 bg-line" /></div>
          <div className="flex flex-col gap-2.5">
            {soon.map((s) => (
              <button key={s} disabled className="btn btn-ghost justify-between">
                <span>{s}</span><span className="soon">Coming soon</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

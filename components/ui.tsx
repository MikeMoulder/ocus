import Link from "next/link";
import { signOut } from "@/app/actions";

export function Logo({ size = 24, light }: { size?: number; light?: boolean }) {
  return (
    <Link href="/" className={`display group inline-flex items-baseline gap-[.18em] leading-none no-underline ${light ? "text-paper" : "text-ink"}`} style={{ fontSize: size }} aria-label="Ocus AI home">
      Ocus<em className={`text-signal transition-colors ${light ? "group-hover:text-go" : "group-hover:text-ink"}`}>AI</em>
    </Link>
  );
}

export function AppHeader({ user, active }: { user: { demo_id: string; name?: string }; active?: "dashboard" | "activity" | "onboard" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`relative px-1 py-2 text-[15px] no-underline transition-colors after:absolute after:inset-x-1 after:-bottom-px after:h-[2px] after:origin-left after:bg-signal after:transition-transform after:duration-300
        ${on ? "font-semibold text-ink after:scale-x-100" : "text-ink-2 after:scale-x-0 hover:text-ink hover:after:scale-x-100"}`}>{label}</Link>
  );
  const name = user.name || user.demo_id;
  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 px-4 sm:px-8">
        <div className="flex w-full items-center justify-between pt-3 sm:w-auto sm:pt-0">
          <Logo />
          <form action={signOut} className="sm:hidden"><button className="text-[13px] text-muted underline">Sign out</button></form>
        </div>
        <nav className="flex gap-5 sm:mr-auto sm:py-3.5">
          {tab("/dashboard", "Dashboard", active === "dashboard")}
          {tab("/activity", "Activity", active === "activity")}
          {tab("/onboard", "Profile", active === "onboard")}
        </nav>
        <form action={signOut} className="hidden items-center gap-3 text-[14px] text-ink-2 sm:flex">
          <span className="tag bg-go text-ink">Pro · early access</span>
          <span className="display inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[16px] text-paper">{name[0]?.toUpperCase()}</span>
          <span className="max-w-[140px] truncate">{name}</span>
          <button className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}

type Tone = "fit" | "stretch" | "no" | "soft" | "warn" | "signal";
export function Badge({ children, tone = "soft" }: { children: React.ReactNode; tone?: Tone }) {
  const cls = {
    fit: "bg-go text-ink", stretch: "border border-ink text-ink", no: "bg-soft text-muted",
    soft: "bg-soft text-ink-2", warn: "bg-warn-soft text-warn-ink", signal: "bg-signal-soft text-signal-ink",
  }[tone];
  return <span className={`tag self-start ${cls}`}>{children}</span>;
}

// Serif page title with one plain sentence under it.
export function PageHead({ kicker, title, sub, children }: { kicker?: string; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="enter flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        {kicker && <span className="eyebrow">{kicker}</span>}
        <h1 className="display text-[40px] leading-[1.02] sm:text-[52px]">{title}</h1>
        {sub && <p className="max-w-[620px] text-[15px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

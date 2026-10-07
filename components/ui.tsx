import Link from "next/link";
import { signOut } from "@/app/actions";

export function Logo() {
  return (
    <Link href="/" className="text-[19px] font-semibold tracking-[-0.02em] text-ink no-underline">
      Ocus AI
    </Link>
  );
}

export function AppHeader({ user, active }: { user: { demo_id: string; name?: string }; active?: "dashboard" | "activity" | "onboard" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`rounded-lg px-3 py-2 text-[15px] ${on ? "bg-soft font-semibold text-ink" : "text-ink-2 hover:bg-soft"}`}>{label}</Link>
  );
  const name = user.name || user.demo_id;
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-7">
          <Logo />
          <nav className="flex gap-1.5">
            {tab("/dashboard", "Dashboard", active === "dashboard")}
            {tab("/activity", "Activity", active === "activity")}
            {tab("/onboard", "Profile", active === "onboard")}
          </nav>
        </div>
        <form action={signOut} className="flex items-center gap-3 text-[15px] text-ink-2">
          <span className="hidden rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-ink sm:inline">Pro · early access</span>
          <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{name[0]?.toUpperCase()}</span>
          <span className="hidden sm:inline">{name}</span>
          <button className="text-sm text-muted underline-offset-2 hover:underline">Sign out</button>
        </form>
      </div>
    </header>
  );
}

export function Badge({ children, tone = "soft" }: { children: React.ReactNode; tone?: "fit" | "stretch" | "no" | "soft" | "warn" }) {
  const cls = {
    fit: "bg-accent-soft text-accent-ink", stretch: "bg-white text-warn-ink border border-[#C7802F]", no: "bg-soft text-muted",
    soft: "bg-soft text-ink-2", warn: "bg-warn-soft text-warn-ink",
  }[tone];
  return <span className={`inline-block self-start rounded-md px-2 py-1 text-[13px] font-semibold ${cls}`}>{children}</span>;
}

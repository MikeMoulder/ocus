// FIND: LinkedIn (via Monid) + public ATS boards. All results are normalized to one shape.
import { linkedinJobs } from "./monid";

export type RawJob = {
  source: string; company: string; domain?: string; title: string; location: string; url: string;
  apply_url?: string; ats?: "ashby" | "greenhouse" | "lever" | "other"; description: string;
};

const BOARDS: { ats: "ashby" | "greenhouse"; slug: string; company: string; domain: string }[] = [
  { ats: "ashby", slug: "livekit", company: "LiveKit", domain: "livekit.io" },
  { ats: "ashby", slug: "supabase", company: "Supabase", domain: "supabase.com" },
  { ats: "ashby", slug: "posthog", company: "PostHog", domain: "posthog.com" },
  { ats: "greenhouse", slug: "canonical", company: "Canonical", domain: "canonical.com" },
];

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
export const atsOf = (url = ""): RawJob["ats"] =>
  /greenhouse\.io|grnh\.se/.test(url) ? "greenhouse" : /ashbyhq\.com/.test(url) ? "ashby" : /lever\.co/.test(url) ? "lever" : "other";
const ENGINEERING = /engineer|developer|programmer|full[- ]?stack|frontend|backend|software|sre|devops/i;
const STOP = new Set(["and", "the", "for", "with", "senior", "junior", "lead", "head", "remote", "level", "staff", "principal", "associate", "assistant",
  // generic job nouns: "manager" alone would match every Product/Account Manager
  "manager", "specialist", "officer", "coordinator", "executive", "consultant", "representative", "director", "supervisor"]);

// "Operations & Business Manager" → ["operations manager", "business manager"]; "Software Engineer | AI" → ["software engineer"].
export function searchTitles(role: string) {
  const main = role.split(/[|,·(]/)[0].trim().toLowerCase();
  const parts = main.split(/\s*(?:&|\/|\band\b)\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [main];
  const first = parts[0].split(/\s+/), last = parts.at(-1)!.split(/\s+/);
  // A one-word part borrows from its neighbour: "operations & business manager", "data analyst / scientist".
  const titles = parts.map((p, i) => {
    if (p.includes(" ")) return p;
    if (i < parts.length - 1 && last.length > 1) return `${p} ${last.at(-1)}`;
    if (i > 0 && first.length > 1) return `${first.slice(0, -1).join(" ")} ${p}`;
    return p;
  });
  return [...new Set(titles)].slice(0, 2);
}

// Does a careers-page job title fit the role we're searching for? Engineers match any engineering title; other roles need a shared keyword.
function matchesRole(title: string, titles: string[]) {
  if (titles.some((t) => ENGINEERING.test(t))) return ENGINEERING.test(title);
  const keys = [...new Set(titles.flatMap((t) => t.split(/\s+/)))].filter((w) => w.length >= 4 && !STOP.has(w));
  const t = title.toLowerCase();
  return keys.some((k) => t.includes(k.replace(/s$/, "")));
}

async function ashby(b: (typeof BOARDS)[number]): Promise<RawJob[]> {
  const d = await (await fetch(`https://api.ashbyhq.com/posting-api/job-board/${b.slug}?includeCompensation=false`)).json();
  return (d.jobs || []).map((j: any) => ({
    source: `${b.company} careers`, company: b.company, domain: b.domain, title: j.title,
    location: [j.location, ...(j.secondaryLocations || []).map((x: any) => x.location)].filter(Boolean).join(" · ") + (j.isRemote ? " (Remote)" : ""),
    url: j.jobUrl, apply_url: j.applyUrl || j.jobUrl, ats: "ashby", description: (j.descriptionPlain || strip(j.descriptionHtml || "")).slice(0, 12000),
  }));
}
async function greenhouse(b: (typeof BOARDS)[number]): Promise<RawJob[]> {
  const d = await (await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`)).json();
  return (d.jobs || []).map((j: any) => ({
    source: `${b.company} careers`, company: b.company, domain: b.domain, title: j.title, location: j.location?.name || "",
    url: j.absolute_url, apply_url: j.absolute_url, ats: "greenhouse", description: strip(unescape(j.content || "")).slice(0, 12000),
  }));
}
async function linkedin(titles: string[], workplace: string[], levels: string[]): Promise<RawJob[]> {
  const items = await linkedinJobs(titles, 25, workplace, levels);
  return items.map((j) => {
    const apply = j.applyMethod?.companyApplyUrl || j.easyApplyUrl || j.linkedinUrl;
    const site = j.company?.website || "";
    return {
      source: "LinkedIn (via Monid)", company: j.company?.name || "Unknown", title: j.title,
      domain: site ? site.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : undefined,
      location: `${j.location?.linkedinText || "Nigeria"} · ${j.workplaceType || "remote"}${(j.workplaceType || "remote") === "remote" ? " (listed for Nigeria)" : ""}`,
      url: j.linkedinUrl, apply_url: apply, ats: atsOf(apply), description: (j.descriptionText || "").slice(0, 12000),
    };
  });
}

// Location eligibility for someone living in Nigeria (code first; the LLM double-checks the description later).
const OPEN = /worldwide|anywhere|global|emea|africa|nigeria|lagos|all locations|work from anywhere/i;
const CLOSED = /north america|americas|apac|latam|united states|\busa?\b|canada|united kingdom|\buk\b|london|germany|berlin|france|paris|netherlands|amsterdam|spain|india|singapore|australia|japan|brazil|mexico|poland|ireland|new york|san francisco|toronto/i;
export function locationVerdict(j: RawJob): { eligible: boolean; reason: string } {
  if (j.source.startsWith("LinkedIn")) return { eligible: true, reason: /remote/i.test(j.location) ? "Listed as remote for Nigeria on LinkedIn" : "Based in Nigeria, where you live" };
  if (OPEN.test(j.location)) return { eligible: true, reason: `Open to your location: "${j.location}"` };
  if (CLOSED.test(j.location) || !/remote|home based/i.test(j.location)) return { eligible: false, reason: `Not open to someone in Nigeria: "${j.location || "on-site"}"` };
  return { eligible: true, reason: `Remote with no country limit listed: "${j.location}"` };
}

export async function findJobs(titles: string[], workplace: string[] = ["remote"], levels?: string[]) {
  const results = await Promise.allSettled([
    linkedin(titles, workplace, levels || ["entry", "associate", "mid-senior"]),
    ...BOARDS.map((b) => (b.ats === "ashby" ? ashby(b) : greenhouse(b))),
  ]);
  const jobs: RawJob[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => (r.status === "fulfilled" ? jobs.push(...r.value) : errors.push(`${i === 0 ? "LinkedIn" : BOARDS[i - 1].company}: ${r.reason?.message || r.reason}`)));
  const seen = new Set<string>();
  const unique = jobs.filter((j) => j.url && !seen.has(j.url) && seen.add(j.url));
  // LinkedIn results were already searched by role, so keep them all; careers pages list every role, so keep only matching titles.
  return { jobs: unique, relevant: unique.filter((j) => j.source.startsWith("LinkedIn") || matchesRole(j.title, titles)), errors };
}

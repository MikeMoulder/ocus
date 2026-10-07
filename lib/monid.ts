// Monid: one API for many data providers (Apify LinkedIn jobs, Apollo people search/enrichment).
const API = "https://api.monid.ai/v1";
const KEY = process.env.MONID_API_KEY;

export async function monidRun(provider: string, endpoint: string, input: any, timeoutMs = 90_000): Promise<any> {
  if (!KEY) throw new Error("MONID_API_KEY missing");
  const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  const r = await fetch(`${API}/run`, { method: "POST", headers, body: JSON.stringify({ provider, endpoint, input }) });
  let d = await r.json();
  if (!r.ok && r.status !== 202) throw new Error(`monid ${endpoint}: ${r.status} ${JSON.stringify(d).slice(0, 300)}`);
  const end = Date.now() + timeoutMs;
  while (d.status && !["COMPLETED", "SUCCEEDED", "FAILED", "ERROR"].includes(d.status) && d.runId && Date.now() < end) {
    await new Promise((res) => setTimeout(res, 2500));
    d = await (await fetch(`${API}/runs/${d.runId}`, { headers })).json();
  }
  if (["FAILED", "ERROR"].includes(d.status)) throw new Error(`monid ${endpoint} failed: ${JSON.stringify(d).slice(0, 300)}`);
  return d;
}

// LinkedIn jobs a Nigeria-based person can take (location = Nigeria; remote and optionally local on-site/hybrid), ~$0.001/result.
export async function linkedinJobs(titles: string[], maxItems = 25, workplace: string[] = ["remote"], levels = ["entry", "associate", "mid-senior"]) {
  const d = await monidRun("apify", "/harvestapi/linkedin-job-search", {
    body: {
      jobTitles: titles, locations: ["Nigeria"], workplaceType: workplace,
      experienceLevel: levels, postedLimit: "week", maxItems, sortBy: "date",
    },
  }, 120_000);
  return (Array.isArray(d.output) ? d.output : []) as any[];
}

// Hiring contact: free Apollo search by company domain, then ONE paid enrichment ($0.026) of the best person.
const PRIORITY = [/technical recruit/i, /recruit/i, /talent/i, /engineering manager/i, /head of engineering|vp.*engineering|cto/i];
export async function findHiringContact(domain: string) {
  const s = await monidRun("apollo", "/mixed_people/api_search", {
    queryParams: {
      "q_organization_domains_list[]": [domain],
      "person_titles[]": ["technical recruiter", "recruiter", "talent acquisition", "talent partner", "engineering manager", "head of engineering"],
      include_similar_titles: true, per_page: 10,
    },
  });
  const people: any[] = s.output?.people || s.providerResponse?.people || [];
  if (!people.length) return { candidates: 0, person: null };
  const rank = (p: any) => { const i = PRIORITY.findIndex((re) => re.test(p.title || "")); return i < 0 ? 99 : i; };
  const best = [...people].sort((a, b) => rank(a) - rank(b))[0];
  let full: any = null;
  try {
    const m = await monidRun("apollo", "/people/match", { queryParams: { id: best.id } }, 30_000);
    full = m.output?.person || m.providerResponse?.person || null;
  } catch { /* enrichment is optional: fall back to the masked search result */ }
  return {
    candidates: people.length,
    others: people.filter((p) => p !== best).slice(0, 4).map((p) => ({ name: `${p.first_name} ${p.last_name_obfuscated || ""}`.trim(), title: p.title })),
    person: {
      name: full?.name || `${best.first_name} ${best.last_name_obfuscated || ""}`.trim(),
      title: full?.title || best.title,
      linkedin_url: full?.linkedin_url || null,
      city: [full?.city, full?.country].filter(Boolean).join(", ") || null,
      enriched: Boolean(full),
    },
  };
}

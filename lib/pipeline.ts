import { llmJson } from "./llm";
import { check } from "./guard.mjs";
import { findJobs, locationVerdict, searchTitles } from "./sources";
import { findHiringContact } from "./monid";
import { addJobs, saveJobs, listJobs, logEvent, updateJob, Job, User } from "./db";

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

function resumeDigest(r: any) {
  const lines: string[] = [`${r.name}, ${r.title}. ${r.summary?.text || ""}`, `Skills: ${(r.skills || []).join(", ")}`];
  for (const e of r.experience || []) lines.push(`${e.role} at ${e.company} (${e.start}–${e.end}): ${e.bullets.map((b: any) => b.text).join(" ")}`);
  for (const p of r.projects || []) lines.push(`Project ${p.name}: ${p.tagline}. Stack: ${(p.stack || []).join(", ")}`);
  return lines.join("\n");
}

// Years of real experience from the resume's dates (internships count half), used to pick LinkedIn seniority levels.
function yearsOfExperience(r: any) {
  let months = 0;
  for (const e of r?.experience || []) {
    const start = Date.parse(`${e.start}-01`), end = e.end === "present" ? Date.now() : Date.parse(`${e.end}-01`);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) months += ((end - start) / 2.63e9) * (/intern/i.test(e.role || "") ? 0.5 : 1);
  }
  return months / 12;
}

// ---------- 1. FIND + FILTER + SCORE ----------
export async function runSearch(user: User) {
  const r = user.resume;
  // Search like a recruiter: the role they want AND the job they actually do now, at a seniority their experience supports.
  const latest = String(r?.experience?.[0]?.role || "").split(/[|,(]/)[0].trim().toLowerCase();
  const titles = [...new Set([...searchTitles((user as any).target_role || r?.title || "software engineer"), ...(latest ? [latest] : [])])].slice(0, 3);
  const years = yearsOfExperience(r);
  const levels = years < 3 ? ["internship", "entry", "associate"] : ["entry", "associate", "mid-senior"];
  await logEvent(user.id, "SEARCH", `Searching LinkedIn (via Monid) and company careers pages for ${titles.map((t) => `"${t}"`).join(", ")} roles (${levels.join("/")} level, ${years.toFixed(1)} yrs experience)…`);
  const workplace = r?.application_facts?.workplace === "remote" ? ["remote"] : ["remote", "hybrid", "office"];
  const { jobs, relevant, errors } = await findJobs(titles, workplace, levels);
  for (const e of errors) await logEvent(user.id, "ERROR", `Source failed: ${e}`);

  const withVerdict = relevant.map((j) => ({ j, v: locationVerdict(j) }));
  const fresh = await addJobs(user.id, withVerdict.map(({ j, v }) => ({
    ...j, status: v.eligible ? "found" : "hidden", eligible: v.eligible, eligibility_reason: v.reason,
  })) as any);
  const hidden = withVerdict.filter((x) => !x.v.eligible).length;
  await logEvent(user.id, "SEARCH", `Scanned ${jobs.length} jobs (${relevant.length} matching your role) from LinkedIn and ${new Set(jobs.map((j) => j.company)).size} companies`);
  await logEvent(user.id, "FILTERED", `Hid ${hidden} matching jobs that are not open to someone in Nigeria`);

  // Cheap pre-rank (resume skills mentioned in the posting) so the LLM scores the most promising 16, seniority not filtered.
  const skills: string[] = (r?.skills || []).map((s: string) => s.toLowerCase());
  const overlap = (j: Job) => { const t = `${j.title} ${j.description}`.toLowerCase(); return skills.filter((s) => t.includes(s)).length + (/\b(ai|agent|llm|full[- ]?stack|typescript|python)\b/i.test(j.title) ? 3 : 0); };
  const toScore = fresh.filter((j) => j.status === "found").sort((a, b) => overlap(b) - overlap(a)).slice(0, 16);
  if (toScore.length) await scoreJobs(user, toScore);
  return { scanned: jobs.length, relevant: relevant.length, hidden, scored: toScore.length, added: fresh.length };
}

async function scoreJobs(user: User, jobs: Job[]) {
  const { data } = await llmJson<{ results: any[] }>(
    `You are a strict, honest technical recruiter. Score how well the candidate fits each job (0-100).
Rules: read "required"/"must have" lines and years-of-experience requirements carefully. If a hard requirement is clearly missing, fit = "no".
"fit" = meets the core requirements; "stretch" = plausible but missing 1-2 things (e.g. seniority or one skill); "no" = clearly not qualified.
Also check location: if the description says the role is limited to countries/regions that exclude Nigeria (or requires US/EU work authorization), set eligible=false.
Return JSON: {"results":[{"i":<index>,"score":int,"fit":"fit"|"stretch"|"no","eligible":bool,"reasons":[3 short strings, each quoting or naming a specific requirement and the matching (or missing) resume evidence]}]}`,
    `CANDIDATE (lives in Nigeria):\n${resumeDigest(user.resume)}\n\nJOBS:\n` +
      jobs.map((j, i) => `[${i}] ${j.title} @ ${j.company} | ${j.location}\n${short(j.description, 2200)}`).join("\n\n"),
  );
  const updated: Job[] = [];
  for (const res of data.results || []) {
    const j = jobs[res.i];
    if (!j) continue;
    const eligible = res.eligible !== false;
    updated.push({
      ...j, score: Math.max(0, Math.min(100, Number(res.score) || 0)), fit: res.fit, reasons: res.reasons || [],
      eligible, status: eligible ? "scored" : "hidden",
      eligibility_reason: eligible ? j.eligibility_reason : "Description limits the role to locations that exclude Nigeria",
    });
  }
  await saveJobs(updated);
  const fits = updated.filter((j) => j.status === "scored" && j.fit !== "no");
  await logEvent(user.id, "SCORED", `Scored ${updated.length} jobs: ${fits.filter((j) => j.fit === "fit").length} fit, ${fits.filter((j) => j.fit === "stretch").length} stretch`);
}

// ---------- 2. TAILOR (LLM + deterministic truth guard) ----------
const TAILOR_SYSTEM = `You tailor a resume to a job WITHOUT inventing anything.
You may only select, reorder, reword and merge lines that exist in the base resume. Every output line must cite the ids of the base lines it came from in "source_ids".
Never add numbers, tools, technologies, employers, titles or claims that are not in the cited lines. Never use a technology the base resume does not mention, even if the job asks for it.
Prefer more bullets with specifics from the cited sources (numbers, tools, outcomes). Pick the 3-4 most relevant projects and keep all experience entries. Fill one page, not more.
Skills must be copied exactly from the base "skills" list, most relevant first.
Return JSON: {"summary":{"text":str,"source_ids":[str]},"skills":[str],"projects":[{"id":"prjN","bullets":[{"text":str,"source_ids":[str]}]}],"experience":[{"id":"expN","bullets":[{"text":str,"source_ids":[str]}]}],"changes":[3 short strings explaining what you emphasized for this job]}`;

function baseForPrompt(r: any) {
  const { skills_from_projects_unverified, application_facts, _note, ...rest } = r;
  return rest;
}

// Remove anything the guard rejects, so what we render is guaranteed honest even if the model keeps slipping.
function dropFailures(base: any, jobText: string, out: any) {
  const res = check(base, jobText, out);
  if (res.ok) return out;
  const bad = (text: string) => res.errors.some((e) => e.includes(`"${text.slice(0, 60)}`));
  const skills = new Set((base.skills || []).map((s: string) => s.toLowerCase()));
  const clean = (items: any[]) => (items || []).map((it) => ({ ...it, bullets: it.bullets.filter((b: any) => !bad(b.text)) })).filter((it) => it.bullets.length);
  return {
    ...out,
    summary: out.summary && !bad(out.summary.text) ? out.summary : { text: base.summary.text, source_ids: [base.summary.id] },
    skills: (out.skills || []).filter((s: string) => skills.has(s.toLowerCase())),
    projects: clean(out.projects), experience: clean(out.experience),
  };
}

export async function tailor(user: User, job: Job) {
  const base = user.resume;
  const jobText = `${job.title}\n${job.description}`;
  const prompt = `BASE RESUME (JSON, the only allowed source of facts):\n${JSON.stringify(baseForPrompt(base))}\n\nJOB: ${job.title} @ ${job.company}\n${short(job.description, 7000)}`;
  let { data: out, model } = await llmJson<any>(TAILOR_SYSTEM, prompt, "quality");
  let res = check(base, jobText, out);
  let attempts = 1;
  if (!res.ok) {
    attempts++;
    ({ data: out, model } = await llmJson<any>(TAILOR_SYSTEM,
      `${prompt}\n\nYOUR PREVIOUS ATTEMPT FAILED THE TRUTH CHECK. Fix every problem below and return the full JSON again:\n- ${res.errors.slice(0, 20).join("\n- ")}\n\nPREVIOUS ATTEMPT:\n${JSON.stringify(out)}`, "quality"));
    res = check(base, jobText, out);
  }
  const firstErrors = res.errors;
  if (!res.ok) { out = dropFailures(base, jobText, out); res = check(base, jobText, out); }
  await logEvent(user.id, "TAILORED", `Tailored your resume for ${job.company}: ${res.cited} of ${res.total} lines cite your resume${attempts > 1 ? ` (truth guard sent it back ${attempts - 1}×)` : ""}`, job.id);
  return updateJob(job.id, {
    tailored: { ...out, model, attempts, removed: firstErrors.length && !check(base, jobText, out).errors.length ? firstErrors : [] },
    guard: { ok: res.ok, cited: res.cited, total: res.total, errors: res.errors },
    status: "tailored",
  });
}

// ---------- 3. HIRING CONTACT + OUTREACH DRAFT ----------
export async function contactAndOutreach(user: User, job: Job) {
  let contact: any = null;
  if (job.domain) {
    try { contact = await findHiringContact(job.domain); } catch (e: any) { await logEvent(user.id, "ERROR", `Contact lookup failed: ${e.message}`, job.id); }
  }
  const person = contact?.person;
  const base = user.resume;
  const { data } = await llmJson<any>(
    `Write a short LinkedIn note (max 3 sentences, < 600 characters) from the candidate to a person at the hiring company, sent AFTER applying.
Name the role, connect ONE specific real project or experience of the candidate to something specific in the job, and end with a low-pressure ask.
Use only facts from the cited resume lines; no numbers or technologies that are not in them. No flattery, no "I hope this finds you well".
Return JSON: {"text":str,"source_ids":[ids of the exact resume lines you used, e.g. "prj4.b2", "exp1.b1", "sum1"]}`,
    `TO: ${person ? `${person.name}, ${person.title}` : `the hiring team at ${job.company}`}\nROLE: ${job.title} @ ${job.company}\nJOB: ${short(job.description, 3000)}\n\nRESUME:\n${JSON.stringify(baseForPrompt(base))}`,
  );
  const ids = (data.source_ids || []).flatMap((id: string) => {
    const item = [...(base.projects || []), ...(base.experience || [])].find((x: any) => x.id === id);
    return item ? item.bullets.map((b: any) => b.id) : id === base.summary?.id || /\.b\d+$/.test(id) ? [id] : [];
  });
  const g = check(base, `${job.title}\n${job.description}`, { summary: { text: data.text, source_ids: ids.length ? ids : [base.summary.id] } });
  await logEvent(user.id, "CONTACT", person ? `Found the hiring contact at ${job.company}: ${person.title} (Apollo via Monid)` : `No public hiring contact found for ${job.company}; drafted a note to the hiring team`, job.id);
  return updateJob(job.id, { contact: contact || { candidates: 0, person: null }, outreach: data.text, ...(g.ok ? {} : { outreach: data.text + "\n\n[Check before sending: " + g.errors.join("; ") + "]" }) });
}

// ---------- 4. SCREENING ANSWERS (facts only, unknown = "needs you") ----------
export function screeningQuestions(user: User) {
  const f = user.resume?.application_facts || {};
  const yn = (v: any) => (v === null || v === undefined ? null : v ? "Yes" : "No");
  return [
    { q: "Country of residence", a: f.country_of_residence ?? null, source: "profile" },
    { q: "LinkedIn profile", a: f.linkedin_url ?? null, source: "profile" },
    { q: "Website / portfolio", a: f.portfolio_url ?? null, source: "profile" },
    { q: "Will you now or in the future require visa sponsorship?", a: yn(f.requires_visa_sponsorship), source: "profile" },
    { q: "Notice period / earliest start date", a: f.notice_period ?? f.earliest_start_date ?? null, source: "profile" },
    { q: "How did you hear about this role?", a: null, source: "needs you" },
  ];
}

export async function prepare(user: User, job: Job) {
  await updateJob(job.id, { status: "scored" });
  // Tailoring and the contact lookup are independent: run them together, then merge.
  const [tailored, withContact] = await Promise.all([tailor(user, job), contactAndOutreach(user, job)]);
  return updateJob(job.id, {
    tailored: tailored.tailored, guard: tailored.guard, status: "tailored",
    contact: withContact.contact, outreach: withContact.outreach,
    questions: job.questions?.length ? job.questions : screeningQuestions(user),
  });
}

export async function stats(userId: string) {
  const jobs = await listJobs(userId);
  const submitted = jobs.filter((j) => j.status === "submitted");
  return {
    scanned: jobs.length, hidden: jobs.filter((j) => j.status === "hidden").length,
    matched: jobs.filter((j) => j.fit && j.fit !== "no" && j.status !== "hidden").length,
    applied: submitted.length, minutesSaved: submitted.length * 40,
  };
}

// Truth guard (deterministic, no LLM): every tailored line must cite real resume lines, add no numbers and no unlisted tech.

const TECH = ["Go", "Golang", "Postgres", "PostgreSQL", "MySQL", "SQL", "Kubernetes", "Docker", "Terraform", "AWS", "GCP", "Azure",
  "Java", "Kotlin", "Swift", "Ruby", "Rails", "Django", "Flask", "Rust", "Elixir", "Scala", "GraphQL", "Redis", "Kafka", "OAuth",
  "OIDC", "SAML", "SSO", "JWT", "SSR", "Vue", "Angular", "Svelte", "PHP", "Laravel", "C++", "Haskell", "Spark", "Airflow",
  "Prometheus", "Grafana", "OpenTelemetry", "gRPC", "Kotlin", "Flutter", "React Native", "TensorFlow", "PyTorch"];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "Go" must be case-sensitive (avoid matching the verb "go"); everything else case-insensitive.
// Acronyms pulled from the job text (e.g. "SMS", "ABOUT" in headings) and "Go" match case-sensitively; other tech terms don't.
const ACR = new Set();
const termRe = (t) => new RegExp(`(?<![A-Za-z0-9])${esc(t)}(?![A-Za-z0-9])`, t === "Go" || ACR.has(t) ? "" : "i");
const numbers = (s) => (s.match(/\d[\d,]*(?:\.\d+)?\+?%?/g) || []).map((n) => n.replace(/,/g, ""));

export function buildIndex(base) {
  const src = new Map();
  src.set(base.summary.id, base.summary.text);
  for (const e of base.experience) for (const b of e.bullets) src.set(b.id, b.text);
  for (const p of base.projects || []) for (const b of p.bullets) src.set(b.id, b.text);
  const { skills_from_projects_unverified, application_facts, _note, ...verified } = base; // unverified skills don't count
  return { src, skills: new Set(base.skills.map((s) => s.toLowerCase())), baseText: JSON.stringify(verified) };
}

export function forbiddenTerms(baseText, jobText) {
  ACR.clear();
  const acronyms = [...new Set(jobText.match(/\b[A-Z]{2,6}\b/g) || [])].filter((a) => !TECH.some((t) => t.toLowerCase() === a.toLowerCase()));
  acronyms.forEach((a) => ACR.add(a));
  return [...new Set([...TECH, ...acronyms])].filter((t) => !termRe(t).test(baseText));
}

export function check(base, jobText, out) {
  const { src, skills, baseText } = buildIndex(base);
  const forbidden = forbiddenTerms(baseText, jobText);
  const errors = [];
  const lines = [];
  if (out.summary) lines.push({ where: "summary", ...out.summary });
  for (const sec of ["experience", "projects"])
    for (const item of out[sec] || []) for (const b of item.bullets) lines.push({ where: `${sec}/${item.id}`, ...b });

  for (const l of lines) {
    const tag = `[${l.where}] "${l.text.slice(0, 60)}${l.text.length > 60 ? "…" : ""}"`;
    const ids = l.source_ids || (l.source_id ? [l.source_id] : []);
    if (!ids.length) { errors.push(`${tag}: no source_id (uncited line)`); continue; }
    const missing = ids.filter((id) => !src.has(id));
    if (missing.length) { errors.push(`${tag}: source ${missing.join(", ")} does not exist in your resume`); continue; }
    const source = ids.map((id) => src.get(id)).join(" ");
    for (const n of numbers(l.text)) if (!numbers(source).includes(n)) errors.push(`${tag}: number "${n}" is not in ${ids.join("+")}`);
    for (const t of forbidden) if (termRe(t).test(l.text)) errors.push(`${tag}: mentions "${t}", which is nowhere in your resume`);
  }
  for (const s of out.skills || []) if (!skills.has(s.toLowerCase())) errors.push(`[skills] "${s}" is not in your resume's skills`);

  const cited = lines.filter((l) => { const ids = l.source_ids || (l.source_id ? [l.source_id] : []); return ids.length && ids.every((id) => src.has(id)); }).length;
  return { ok: errors.length === 0, cited, total: lines.length, errors, forbiddenSample: forbidden.slice(0, 12) };
}


// AUTOPILOT: the agent runs on its own. Search → score → prepare the best few → ONE approval email with a link per job.
// The user never has to watch the site; they act from their inbox. Runs on start, then daily at 8:00 Lagos time.
import { getUser, listJobs, listUsers, logEvent, updateJob, updateUser, Job, User } from "./db";
import { runSearch, prepare } from "./pipeline";
import { sendEmail } from "./agent37";
import { jobToken } from "./auth";

const PER_RUN = 3; // jobs prepared and sent for approval per run
const MIN_SCORE = 60;
const RUN_HOUR_LAGOS = 8; // Lagos is UTC+1, no DST
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type Autopilot = { enabled: boolean; running?: string | null; last_run?: string; next_run?: string; last_result?: string };

export function nextRunAfter(d = new Date()) {
  const n = new Date(d);
  n.setUTCHours(RUN_HOUR_LAGOS - 1, 0, 0, 0); // 08:00 Lagos = 07:00 UTC
  if (n <= d) n.setUTCDate(n.getUTCDate() + 1);
  return n.toISOString();
}

// Jobs the agent can actually apply to come first (Greenhouse/Ashby/Lever forms), then by score.
function pick(jobs: Job[]) {
  const canApply = (j: Job) => (["ashby", "greenhouse", "lever"].includes(j.ats || "") ? 1 : 0);
  return jobs
    .filter((j) => j.status === "scored" && j.eligible !== false && j.fit !== "no" && (j.score ?? 0) >= MIN_SCORE)
    .sort((a, b) => canApply(b) - canApply(a) || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, PER_RUN);
}

async function sendDigest(user: User, jobs: Job[], appUrl: string) {
  const rows = await Promise.all(jobs.map(async (j) => {
    const link = `${appUrl}/jobs/${j.id}?t=${await jobToken(user.id, j.id)}`;
    const needs = (j.questions || []).filter((q) => !q.a).length;
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #eee">
<b>${j.score}% · ${esc(j.company)}, ${esc(j.title)}</b><br>
<span style="color:#555">${esc(j.location)}</span><br>
<span style="color:#333">${esc((j.reasons || [])[0] || "")}</span><br>
<span style="color:#555">Resume tailored (${j.guard?.cited}/${j.guard?.total} lines from your real resume)${j.contact?.person ? ` · ${esc(j.contact.person.title)} found, note drafted` : ""}${needs ? ` · ${needs} question${needs > 1 ? "s" : ""} need you` : ""}</span><br>
<a href="${link}" style="display:inline-block;margin-top:8px;background:#0F766E;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:600">Review and approve →</a>
</td></tr>`;
  }));
  const html = `<p>Hi ${esc(user.name || "there")}, your agent found <b>${jobs.length} job${jobs.length > 1 ? "s" : ""}</b> you can apply to from where you live, and prepared everything.</p>
<table style="width:100%;border-collapse:collapse">${rows.join("")}</table>
<p style="color:#666">Nothing is submitted until you approve. Links work for 72 hours on any device.<br>Ocus AI</p>`;
  return sendEmail(user.agent37_instance_id!, user.email!, `${jobs.length} job match${jobs.length > 1 ? "es" : ""} ready for your approval`, html);
}

export async function runAutopilot(userId: string, appUrl: string) {
  let user = (await getUser(userId))!;
  const ap: Autopilot = (user as any).autopilot || { enabled: true };
  if (ap.running && Date.now() - Date.parse(ap.running) < 15 * 60_000) return; // already running
  await updateUser(user.id, { autopilot: { ...ap, running: new Date().toISOString() }, searching: new Date().toISOString() } as any);
  let result = "";
  try {
    await logEvent(user.id, "AUTOPILOT", "Autopilot run started: searching, scoring and preparing your best matches");
    const r = await runSearch(user);
    user = (await getUser(userId))!;
    const prev = (user as any).totals || { scanned: 0, hidden: 0 };
    await updateUser(user.id, { totals: { scanned: prev.scanned + r.scanned, hidden: prev.hidden + r.hidden, last: new Date().toISOString() } } as any);

    const best = pick(await listJobs(user.id));
    if (!best.length) {
      result = "No new strong matches this time";
      await logEvent(user.id, "AUTOPILOT", `${result}. Next search tomorrow at 8:00 AM.`);
    } else {
      await logEvent(user.id, "AUTOPILOT", `Preparing your top ${best.length}: ${best.map((j) => j.company).join(", ")}`);
      const ready = (await Promise.allSettled(best.map((j) => prepare(user, j))))
        .flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
      if (user.gmail_active && user.email && user.agent37_instance_id && ready.length) {
        const sent = await sendDigest(user, ready, appUrl);
        if (sent.ok) for (const j of ready) await updateJob(j.id, { status: "awaiting_approval" });
        await logEvent(user.id, sent.ok ? "EMAIL" : "ERROR", sent.ok ? `Emailed you ${ready.length} match${ready.length > 1 ? "es" : ""} to approve` : `Approval email failed: ${sent.text.slice(0, 160)}`);
        result = `${ready.length} prepared and emailed`;
      } else {
        result = `${ready.length} prepared (connect Gmail to get them by email)`;
        await logEvent(user.id, "AUTOPILOT", `${ready.length} matches ready on your dashboard. Connect Gmail to get them by email.`);
      }
    }
  } catch (e: any) {
    result = `Failed: ${e.message}`.slice(0, 200);
    await logEvent(user.id, "ERROR", `Autopilot run failed: ${e.message}`);
  } finally {
    const cur = (((await getUser(userId)) as any)?.autopilot || ap) as Autopilot;
    await updateUser(userId, { searching: null, autopilot: { ...cur, running: null, last_run: new Date().toISOString(), next_run: nextRunAfter(), last_result: result } } as any);
  }
}

// Called every few minutes by the scheduler (instrumentation.ts): run anyone whose daily run is due, one at a time.
let ticking = false;
export async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
    const due = (await listUsers()).filter((u: any) => u.autopilot?.enabled && u.resume && u.autopilot.next_run && Date.parse(u.autopilot.next_run) <= Date.now());
    for (const u of due) await runAutopilot(u.id, appUrl);
  } catch (e) {
    console.error("autopilot tick failed", e);
  } finally {
    ticking = false;
  }
}

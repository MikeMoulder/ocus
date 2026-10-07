import { renderResumePdf } from "./pdf";
import { runTurn, uploadFile, sendEmail } from "./agent37";
import { getJob, getUser, logEvent, updateJob, Job, User } from "./db";
import { jobToken } from "./auth";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fileName = (u: User, j: Job) => `${(u.resume?.name || "resume").replace(/\s+/g, "_")}_${j.company.replace(/\W+/g, "")}.pdf`;

export async function tailoredPdf(user: User, job: Job) {
  return renderResumePdf(user.resume, job.tailored);
}

// ASK: the approval email links to the review page with a 72h token for this job only. Approve is a POST on that page.
export async function sendApprovalEmail(user: User, job: Job, appUrl: string) {
  if (!user.agent37_instance_id || !user.email) throw new Error("Connect Gmail and add your email first");
  const link = `${appUrl}/jobs/${job.id}?t=${await jobToken(user.id, job.id)}`;
  const needs = (job.questions || []).filter((q) => !q.a);
  const html = `<p><b>${job.score ?? "?"}% match: ${esc(job.company)} · ${esc(job.title)}</b></p>
<p>${esc(job.eligibility_reason || "")}</p>
<p><b>Why:</b> ${esc((job.reasons || [])[0] || "")}<br><b>Resume:</b> tailored, ${job.guard?.cited}/${job.guard?.total} lines come from your real resume.<br>
<b>Contact:</b> ${job.contact?.person ? `${esc(job.contact.person.title)} found, outreach drafted for you to send.` : "outreach drafted for the hiring team."}</p>
${needs.length ? `<p><b>${needs.length} question${needs.length > 1 ? "s" : ""} need${needs.length > 1 ? "" : "s"} you:</b> ${needs.map((q) => esc(q.q)).join("; ")}</p>` : ""}
<p><a href="${link}">Review and approve →</a></p><p style="color:#666">Nothing is submitted until you approve.<br>Ocus AI</p>`;
  await logEvent(user.id, "EMAIL", `Sending you an approval request for ${job.company} – ${job.title}`, job.id);
  const r = await sendEmail(user.agent37_instance_id, user.email, `${job.score ?? ""}% match: ${job.company} · ${job.title}: approve?`, html);
  await logEvent(user.id, r.ok ? "EMAIL" : "ERROR", r.ok ? `Approval email sent to ${user.email}` : `Approval email failed: ${r.text.slice(0, 200)}`, job.id);
  return updateJob(job.id, { status: "awaiting_approval" });
}

// APPLY: upload the PDF to the user's Agent37 computer, then the agent fills and submits the form in its browser.
export async function applyWithAgent(userId: string, jobId: string, appUrl: string) {
  const user = (await getUser(userId))!;
  let job = (await getJob(jobId))!;
  const inst = user.agent37_instance_id!;
  try {
    job = await updateJob(job.id, { status: "applying" });
    await logEvent(user.id, "APPLY", `Rendering your tailored PDF and sending it to your private Agent37 computer`, job.id);
    const pdf = await tailoredPdf(user, job);
    const path = await uploadFile(inst, `~/jobpilot/${fileName(user, job)}`, pdf);
    const f = user.resume.application_facts || {};
    const answers = (job.questions || []).map((q) => `- ${q.q}: ${q.a ?? "(leave blank if optional)"}`).join("\n");
    const prompt = `You are applying to a job for ${user.resume.name}. Use the browser.
1. Open ${job.apply_url || job.url}
2. If there is an "Apply" button, click it to open the application form.
3. Fill the form with ONLY these facts:
- Full name: ${user.resume.name}
- Email: ${user.resume.contact?.email}
- Phone: ${user.resume.contact?.phone}
- Location: ${user.resume.contact?.location}
- LinkedIn: ${f.linkedin_url || ""}
- GitHub/Portfolio: ${f.portfolio_url || user.resume.contact?.github || ""}
${answers}
4. Upload the resume file at ${path} (attached) as the resume/CV.
5. For any REQUIRED field not covered above, stop and report the field name instead of guessing.
6. If you see a CAPTCHA, a login wall, or an error, stop and report it.
7. Submit the application, then take a screenshot of the confirmation page.
Finish with exactly one line: "RESULT: SUBMITTED" or "RESULT: BLOCKED - <reason>", followed by a 3-line summary of what you did.`;
    const r = await runTurn(inst, prompt, {
      files: [path],
      onStep: (s) => logEvent(user.id, "AGENT", s, job.id),
    });
    const submitted = r.ok && /RESULT:\s*SUBMITTED/i.test(r.text);
    job = await updateJob(job.id, {
      status: submitted ? "submitted" : "failed", agent_result: r.text.slice(0, 2000),
      applied_at: submitted ? new Date().toISOString() : undefined,
    });
    await logEvent(user.id, submitted ? "APPLIED" : "BLOCKED", submitted
      ? `Applied to ${job.company} – ${job.title}${r.usage?.cost_usd ? ` (agent cost $${Number(r.usage.cost_usd).toFixed(3)})` : ""}`
      : `Could not finish ${job.company}: ${(r.text.match(/RESULT:.*$/m)?.[0] || r.text).slice(0, 200)}. Finish manually with everything pre-filled.`, job.id);
    if (user.email) {
      const html = submitted
        ? `<p><b>Applied ✅ ${esc(job.company)} · ${esc(job.title)}</b></p><p>${esc(r.text.slice(0, 600)).replace(/\n/g, "<br>")}</p>
${job.outreach ? `<p><b>Your note${job.contact?.person ? ` for ${esc(job.contact.person.name)} (${esc(job.contact.person.title)})` : ""}:</b><br>${esc(job.outreach)}</p>${job.contact?.person?.linkedin_url ? `<p><a href="${job.contact.person.linkedin_url}">Open their LinkedIn to send it →</a></p>` : ""}` : ""}
<p><a href="${appUrl}/jobs/${job.id}">See it in Ocus AI</a></p>`
        : `<p><b>Needs you: ${esc(job.company)} · ${esc(job.title)}</b></p><p>${esc(r.text.slice(0, 600))}</p><p><a href="${job.apply_url || job.url}">Finish manually →</a></p>`;
      await sendEmail(inst, user.email, submitted ? `Applied ✅ ${job.company} · ${job.title}` : `Needs you: ${job.company} · ${job.title}`, html)
        .then(() => logEvent(user.id, "EMAIL", submitted ? "Sent you the \"Applied ✅\" confirmation" : "Emailed you what's left to finish", job.id))
        .catch(() => {});
    }
  } catch (e: any) {
    await updateJob(job.id, { status: "failed", agent_result: e.message });
    await logEvent(user.id, "ERROR", `Apply failed: ${e.message}`, job.id);
  }
}

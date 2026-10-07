"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import sample from "@/lib/sample_resume.json";
import { checkPasscode, currentUser, endSession, hashPasscode, startSession, verifyJobToken } from "@/lib/auth";
import { createUser, getJob, getUser, logEvent, updateJob, updateUser, userByDemoId } from "@/lib/db";
import { prepare, runSearch } from "@/lib/pipeline";
import { connectGmail, ensureInstance, gmailStatus } from "@/lib/agent37";
import { applyWithAgent, sendApprovalEmail } from "@/lib/apply";
import { parseResumePdf } from "@/lib/resume";
import { nextRunAfter, runAutopilot } from "@/lib/autopilot";

async function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") || "http"}://${h.get("x-forwarded-host") || h.get("host")}`;
}
const firstName = (n?: string) => { const w = String(n || "").trim().split(/\s+/)[0] || ""; return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""; };

async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/signin");
  return u;
}

// ---------- auth ----------
export async function signIn(_: any, form: FormData) {
  const demoId = String(form.get("demo_id") || "").trim().toLowerCase();
  const pass = String(form.get("passcode") || "");
  if (demoId.length < 3 || pass.length < 4) return { error: "Demo ID needs 3+ characters and passcode 4+." };
  let user = await userByDemoId(demoId);
  if (user) {
    if (!(await checkPasscode(pass, user.passcode_hash))) return { error: "That Demo ID is taken, or the passcode is wrong." };
  } else {
    user = await createUser(demoId, await hashPasscode(pass));
  }
  await startSession(user.id);
  redirect(user.resume ? "/dashboard" : "/onboard");
}
export async function signOut() {
  await endSession();
  redirect("/");
}

// ---------- onboarding ----------
export async function uploadResume(_: any, form: FormData) {
  const u = await requireUser();
  const file = form.get("resume") as File | null;
  if (!file || !file.size) return { error: "Choose a PDF file first." };
  if (file.type && file.type !== "application/pdf") return { error: "Please upload a PDF." };
  if (file.size > 5 * 1024 * 1024) return { error: "That file is over 5 MB." };
  try {
    const { resume, check } = await parseResumePdf(new Uint8Array(await file.arrayBuffer()));
    // Keep any form facts the user already filled in.
    resume.application_facts = { ...resume.application_facts, ...(u.resume?.application_facts || {}), ...Object.fromEntries(Object.entries(resume.application_facts).filter(([, v]) => v != null)) };
    await updateUser(u.id, { resume: { ...resume, source: { kind: "pdf", file: file.name, check, at: new Date().toISOString() } }, name: firstName(resume.name) || u.name, email: u.email || resume.contact?.email });
    await logEvent(u.id, "RESUME", `Read your resume "${file.name}": ${check.matched} of ${check.total} lines copied word-for-word`);
    revalidatePath("/onboard");
    return { ok: true, check };
  } catch (e: any) {
    return { error: e.message?.slice(0, 200) || "Couldn't read that PDF." };
  }
}

export async function loadDemoResume() {
  const u = await requireUser();
  const resume = { ...(sample as any), source: { kind: "demo" } };
  resume.application_facts = { ...resume.application_facts, ...(u.resume?.application_facts || {}) };
  await updateUser(u.id, { resume, name: "Michael", email: u.email || resume.contact.email });
  revalidatePath("/onboard");
}

export async function saveFacts(_: any, form: FormData) {
  const u = await requireUser();
  if (!u.resume) return { error: "Add your resume first (step 1)." };
  const str = (k: string) => String(form.get(k) || "").trim() || null;
  const visa = form.get("requires_visa_sponsorship");
  const facts = {
    ...(u.resume.application_facts || {}),
    country_of_residence: str("country_of_residence"),
    linkedin_url: str("linkedin_url"),
    portfolio_url: str("portfolio_url"),
    notice_period: str("notice_period"),
    workplace: str("workplace") || "any",
    requires_visa_sponsorship: visa === "yes" ? true : visa === "no" ? false : null,
  };
  await updateUser(u.id, { email: str("email") || u.email, target_role: str("target_role"), resume: { ...u.resume, application_facts: facts } } as any);
  revalidatePath("/onboard");
  return { ok: true };
}

export async function connectGmailAction() {
  const u = await requireUser();
  const instance = await ensureInstance(u.agent37_instance_id);
  if (instance !== u.agent37_instance_id) {
    await updateUser(u.id, { agent37_instance_id: instance });
    await logEvent(u.id, "AGENT", `Your private Agent37 computer is ready (${instance})`);
  }
  const r = await connectGmail(instance, `${await appUrl()}/onboard?gmail=done`);
  await updateUser(u.id, { gmail_account_id: r.connectedAccountId, gmail_active: false });
  redirect(r.redirectUrl);
}
export async function refreshGmail() {
  const u = await requireUser();
  if (!u.agent37_instance_id) return { active: false };
  const s = await gmailStatus(u.agent37_instance_id, u.gmail_account_id);
  const active = s?.status === "ACTIVE";
  if (active !== Boolean(u.gmail_active)) {
    await updateUser(u.id, { gmail_active: active, gmail_account_id: s?.id || u.gmail_account_id });
    if (active) await logEvent(u.id, "GMAIL", "Gmail connected: approvals and confirmations will come from your own inbox");
  }
  return { active, status: s?.status || "NOT_CONNECTED" };
}

// ---------- pipeline ----------
// AUTOPILOT: one round runs now in the background (search → prepare top matches → approval email), then daily at 8:00 Lagos.
export async function startAutopilot() {
  const u = await requireUser();
  if (!u.resume) redirect("/onboard");
  const url = await appUrl();
  await updateUser(u.id, { plan: "pro", autopilot: { ...((u as any).autopilot || {}), enabled: true, next_run: nextRunAfter() } } as any);
  await logEvent(u.id, "AUTOPILOT", "Autopilot on: your agent searches every day at 8:00 AM (Lagos) and emails you matches to approve");
  after(() => runAutopilot(u.id, url));
  redirect("/dashboard?started=1");
}

export async function pauseAutopilot() {
  const u = await requireUser();
  await updateUser(u.id, { autopilot: { ...((u as any).autopilot || {}), enabled: false } } as any);
  await logEvent(u.id, "AUTOPILOT", "Autopilot paused");
  revalidatePath("/dashboard");
}

export async function runSearchAction() {
  const u = await requireUser();
  const url = await appUrl();
  await updateUser(u.id, { searching: new Date().toISOString() } as any);
  after(() => runAutopilot(u.id, url));
  revalidatePath("/dashboard");
}

export async function prepareAction(jobId: string) {
  const u = await requireUser();
  const job = await getJob(jobId);
  if (!job || job.user_id !== u.id || (job as any).preparing) return;
  await updateJob(jobId, { preparing: new Date().toISOString() } as any);
  after(async () => {
    try {
      await prepare(u, job);
    } catch (e: any) {
      await logEvent(u.id, "ERROR", `Preparing failed: ${e.message}`, jobId);
    } finally {
      await updateJob(jobId, { preparing: null } as any);
    }
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function sendApprovalAction(jobId: string) {
  const u = await requireUser();
  const job = await getJob(jobId);
  if (!job || job.user_id !== u.id) return;
  await sendApprovalEmail(u, job, await appUrl());
  revalidatePath(`/jobs/${jobId}`);
}

export async function saveOutreach(jobId: string, form: FormData) {
  const u = await requireUser();
  const job = await getJob(jobId);
  if (!job || job.user_id !== u.id) return;
  await updateJob(jobId, { outreach: String(form.get("outreach") || "") });
  revalidatePath(`/jobs/${jobId}`);
}

// Approve works from a signed-in session OR the 72h job token from the email; it is always a POST from the page.
async function ownerOf(jobId: string, token?: string) {
  const job = await getJob(jobId);
  if (!job) return null;
  const me = await currentUser();
  const uid = me?.id === job.user_id ? me.id : token ? await verifyJobToken(token, jobId) : null;
  return uid === job.user_id ? { job, user: (await getUser(uid))! } : null;
}

export async function approveAction(jobId: string, token: string | undefined, form: FormData) {
  const o = await ownerOf(jobId, token);
  if (!o) redirect("/signin");
  const questions = (o.job.questions || []).map((q, i) => ({ ...q, a: String(form.get(`q${i}`) ?? q.a ?? "").trim() || q.a }));
  await updateJob(jobId, { questions, status: "approved" });
  await logEvent(o.user.id, "APPROVED", `You approved ${o.job.company} – ${o.job.title}`, jobId);
  const url = await appUrl();
  after(() => applyWithAgent(o.user.id, jobId, url));
  redirect(`/jobs/${jobId}${token ? `?t=${token}` : ""}`);
}

export async function skipAction(jobId: string, token?: string) {
  const o = await ownerOf(jobId, token);
  if (!o) redirect("/signin");
  await updateJob(jobId, { status: "skipped" });
  await logEvent(o.user.id, "SKIPPED", `You skipped ${o.job.company} – ${o.job.title}`, jobId);
  redirect(token ? `/jobs/${jobId}?t=${token}` : "/dashboard");
}

"use client";
import { useActionState, useState } from "react";
import { uploadResume, saveFacts } from "@/app/actions";
import { Submit } from "@/components/submit";
import { Info } from "@/components/info";

export function Field({ label, info, hint, children }: { label: string; info: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[14px] font-medium text-ink">{label}<Info label={`About ${label}`}>{info}</Info></span>
      {children}
      {hint && <span className="text-[12.5px] text-muted">{hint}</span>}
    </div>
  );
}

export function UploadForm({ compact }: { compact?: boolean }) {
  const [state, action] = useActionState(uploadResume, null as any);
  const [file, setFile] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label
        onDragOver={() => setDrag(true)} onDragLeave={() => setDrag(false)} onDrop={() => setDrag(false)}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-colors
          ${compact ? "px-4 py-5" : "px-6 py-10"} ${drag ? "border-accent bg-accent-soft" : file ? "border-accent/60 bg-accent-soft/50" : "border-[#D6D6D0] bg-bg hover:border-accent/60"}`}>
        <input type="file" name="resume" accept="application/pdf,.pdf" required className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => setFile(e.target.files?.[0]?.name || null)} />
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        {file ? <span className="text-[15px] font-semibold text-ink">{file}</span>
          : <span className="text-[15px] font-semibold text-ink">{compact ? "Upload a new PDF" : "Drop your resume here, or tap to choose"}</span>}
        <span className="text-[13px] text-muted">PDF with selectable text · up to 5 MB</span>
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn-ink">{state.error}</p>}
      {file && <Submit pending="Reading your resume… (about 15s)">{compact ? "Replace resume" : "Upload and read"}</Submit>}
    </form>
  );
}

export function FactsForm({ d }: { d: Record<string, any> }) {
  const [state, action] = useActionState(saveFacts, null as any);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Role to search for" hint="Defaults to your resume headline"
          info="The job title your agent searches LinkedIn and company careers pages for every day, e.g. “Software Engineer” or “Frontend Developer”.">
          <input name="target_role" className="input" defaultValue={d.target_role} placeholder={d.title_hint || "Software Engineer"} />
        </Field>
        <Field label="Email for approvals"
          info="Your agent emails you here, from your own Gmail, before it applies anywhere and after each application. It never emails anyone else.">
          <input name="email" type="email" className="input" defaultValue={d.email} required placeholder="you@example.com" />
        </Field>
        <Field label="Country you live in"
          info="Used to hide jobs you can’t legally take from where you live, and to answer “Where are you based?” on application forms.">
          <input name="country_of_residence" className="input" defaultValue={d.country_of_residence || "Nigeria"} required />
        </Field>
        <Field label="Work type"
          info="Remote-only searches for jobs anywhere that accept people in your country. Including on-site and hybrid also finds jobs in your own country, which you can legally take.">
          <select name="workplace" className="input" defaultValue={d.workplace || "any"}>
            <option value="any">Remote, plus on-site or hybrid in my country</option>
            <option value="remote">Remote only</option>
          </select>
        </Field>
        <Field label="Need visa sponsorship?"
          info="Many forms ask this. “Ask me each time” leaves it blank, and the agent asks you on the approval page instead of guessing.">
          <select name="requires_visa_sponsorship" className="input" defaultValue={d.visa}>
            <option value="">Ask me each time</option>
            <option value="no">No, I work remotely from my country</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Notice period" hint="Optional"
          info="How soon you could start. Answers “When can you start?” on forms. Leave blank to be asked per job.">
          <input name="notice_period" className="input" defaultValue={d.notice_period} placeholder="e.g. 2 weeks" />
        </Field>
        <Field label="LinkedIn profile" hint="Optional"
          info="Filled into the LinkedIn field on applications and printed on your tailored resume.">
          <input name="linkedin_url" type="url" className="input" defaultValue={d.linkedin_url} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label="Portfolio or GitHub" hint="Optional"
          info="Filled into the “Website / portfolio” field on applications.">
          <input name="portfolio_url" type="url" className="input" defaultValue={d.portfolio_url} placeholder="https://github.com/…" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending="Saving…">Save details</Submit>
        {state?.ok && <span className="text-[14px] font-medium text-accent" role="status">✓ Saved</span>}
        {state?.error && <span className="text-[14px] text-warn-ink" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}

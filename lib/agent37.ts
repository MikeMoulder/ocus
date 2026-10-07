// Agent37: each user gets a private cloud computer (Hermes agent + Chromium + Gmail via managed Composio).
// All calls are server-side; the sk_live_ key never reaches the browser.
const KEY = process.env.AGENT37_API_KEY || process.env.AGENT27_API_KEY;
const API = "https://api.agent37.com/v1";
const H = () => ({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
const AH = () => ({ "X-Agent37-Key": KEY!, "Content-Type": "application/json" });
const inst = (id: string) => `https://${id}.agent37.app`;

export const agent37Configured = () => Boolean(KEY);

async function call(url: string, init: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let d: any; try { d = JSON.parse(text); } catch { d = { raw: text }; }
  if (!r.ok) throw new Error(`Agent37 ${r.status}: ${text.slice(0, 300)}`);
  return d;
}

export async function listInstances() {
  return (await call(`${API}/instances`, { headers: H() })).data as any[];
}
// New workspaces have credit for ONE instance, so reuse an existing one when there is one.
export async function ensureInstance(existing?: string) {
  if (existing) return existing;
  const found = (await listInstances()).find((i) => i.status !== "deleted");
  if (found) return found.id as string;
  const d = await call(`${API}/instances`, { method: "POST", headers: H(), body: JSON.stringify({ name: "jobpilot", budget: { credit_micros: 1_000_000 }, auto_sleep: true }) });
  return d.id as string;
}

export async function connectGmail(instanceId: string, callbackUrl?: string) {
  const body: any = { toolkit: "gmail" };
  if (callbackUrl?.startsWith("https://")) body.callbackUrl = callbackUrl;
  return call(`${API}/instances/${instanceId}/integrations/connect`, { method: "POST", headers: H(), body: JSON.stringify(body) }) as Promise<{ connectedAccountId: string; redirectUrl: string }>;
}
export async function gmailStatus(instanceId: string, accountId?: string) {
  const d = await call(`${API}/instances/${instanceId}/integrations/connections?toolkit=gmail`, { headers: H() });
  const list: any[] = d.connections || d.data || [];
  const c = accountId ? list.find((x) => x.id === accountId) : list.find((x) => x.status === "ACTIVE") || list[0];
  return c ? { id: c.id as string, status: c.status as string } : null;
}

export async function uploadFile(instanceId: string, path: string, data: Buffer) {
  const r = await fetch(`${inst(instanceId)}/v1/files/content?path=${encodeURIComponent(path)}`, {
    method: "PUT", headers: { "X-Agent37-Key": KEY! }, body: new Uint8Array(data),
  });
  if (!r.ok) throw new Error(`Agent37 upload ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json().catch(() => ({}));
  return (d.path as string) || path;
}

// One agent turn, streamed: onStep gets a line per tool call (browser_navigate → URL, etc.).
export async function runTurn(instanceId: string, input: string, opts: { files?: string[]; onStep?: (s: string) => void | Promise<void> } = {}) {
  const r = await fetch(`${inst(instanceId)}/v1/responses`, {
    method: "POST", headers: AH(), body: JSON.stringify({ input, files: opts.files, stream: true }),
  });
  if (!r.ok || !r.body) throw new Error(`Agent37 turn ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", final: any = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = frame.match(/^event: (.*)$/m)?.[1];
      const raw = frame.match(/^data: (.*)$/m)?.[1];
      if (!ev || !raw) continue;
      let d: any; try { d = JSON.parse(raw); } catch { continue; }
      if (ev === "response.tool_call.started") await opts.onStep?.(`${d.tool}${d.label ? `: ${String(d.label).slice(0, 120)}` : ""}`);
      else if (ev === "response.tool_call.failed") await opts.onStep?.(`${d.tool} failed${d.error ? `: ${String(d.error).slice(0, 120)}` : ""}`);
      else if (ev === "response.output_text.delta") text += d.text;
      else if (ev === "response.completed" || ev === "response.failed") final = { ev, ...d };
    }
  }
  return { text: final?.output_text || text, ok: final?.ev === "response.completed", usage: final?.usage, raw: final };
}

export async function sendEmail(instanceId: string, to: string, subject: string, body: string) {
  return runTurn(instanceId,
    `Using the connected Gmail account, send ONE email now.\nTo: ${to}\nSubject: ${subject}\nBody (send as HTML exactly as given, do not change links):\n${body}\n\nReply only with "sent" or the exact error.`);
}

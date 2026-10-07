// Storage, picked by env: Postgres (DATABASE_URL, e.g. InstaCloud) → Supabase (SUPABASE_URL + key) → local JSON file (.data/db.json).
// Every row is {id, user_id, ...fields}; the SQL backends keep the fields in a jsonb `data` column (see supabase/schema.sql).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";

export type Fit = "fit" | "stretch" | "no";
export type Status =
  | "found" | "hidden" | "scored" | "tailored" | "awaiting_approval"
  | "approved" | "applying" | "submitted" | "failed" | "skipped";

export type User = {
  id: string; demo_id: string; passcode_hash: string; name?: string; email?: string;
  resume?: any; agent37_instance_id?: string; gmail_account_id?: string; gmail_active?: boolean;
  created_at: string;
};
export type Job = {
  id: string; user_id: string; source: string; company: string; domain?: string; title: string; location: string;
  url: string; apply_url?: string; ats?: "ashby" | "greenhouse" | "lever" | "other"; description: string;
  status: Status; eligible?: boolean; eligibility_reason?: string; score?: number; fit?: Fit; reasons?: string[];
  tailored?: any; guard?: { ok: boolean; cited: number; total: number; errors: string[] };
  contact?: any; outreach?: string; questions?: { q: string; a: string | null; source: string }[];
  agent_result?: string; applied_at?: string; created_at: string; updated_at: string;
};
export type Event = { id: string; user_id: string; job_id?: string; kind: string; text: string; at: string };

type Table = "users" | "jobs" | "events";
const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

// ---------- backend ----------
const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
let sb: SupabaseClient | null = null;
const PG_URL = process.env.DATABASE_URL;
let pool: Pool | null = null;
let pgReady: Promise<void> | null = null;
async function pg() {
  pool ??= new Pool({ connectionString: PG_URL, max: 5, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(PG_URL!) ? false : { rejectUnauthorized: false } });
  // Create the tables on first use, so a fresh database needs no manual migration.
  pgReady ??= pool.query(fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8")).then(() => {});
  await pgReady;
  return pool;
}
export const backend = () => (PG_URL ? "postgres" : SB_URL && SB_KEY ? "supabase" : "file");
export const usingSupabase = () => backend() === "supabase";
const supa = () => (sb ??= createClient(SB_URL!, SB_KEY!, { auth: { persistSession: false } }));

const FILE = path.join(process.cwd(), ".data", "db.json");
type FileDb = Record<Table, any[]>;
function load(): FileDb {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { users: [], jobs: [], events: [] }; }
}
function save(db: FileDb) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(db));
  fs.renameSync(FILE + ".tmp", FILE);
}

const toRow = (o: any) => { const { id, user_id, ...data } = o; return { id, user_id: user_id ?? null, data }; };
const fromRow = (r: any) => (r ? { ...r.data, id: r.id, user_id: r.user_id } : null);

async function all<T>(t: Table, userId?: string): Promise<T[]> {
  if (backend() === "postgres") {
    const { rows } = await (await pg()).query(`select * from ${t} ${userId ? "where user_id = $1" : ""} order by created_at desc limit 2000`, userId ? [userId] : []);
    return rows.map(fromRow);
  }
  if (usingSupabase()) {
    let q = supa().from(t).select("*").order("created_at", { ascending: false }).limit(1000);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw new Error(`supabase ${t}: ${error.message}`);
    return (data || []).map(fromRow);
  }
  const rows = load()[t];
  return (userId ? rows.filter((r) => r.user_id === userId) : rows) as T[];
}

async function get<T>(t: Table, id: string): Promise<T | null> {
  if (backend() === "postgres") {
    const { rows } = await (await pg()).query(`select * from ${t} where id = $1`, [id]);
    return fromRow(rows[0]);
  }
  if (usingSupabase()) {
    const { data, error } = await supa().from(t).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`supabase ${t}: ${error.message}`);
    return fromRow(data);
  }
  return (load()[t].find((r) => r.id === id) as T) ?? null;
}

async function put<T extends { id: string }>(t: Table, rows: T[]) {
  if (!rows.length) return;
  if (backend() === "postgres") {
    const db = await pg();
    for (const r of rows.map(toRow))
      await db.query(`insert into ${t} (id, user_id, data) values ($1, $2, $3) on conflict (id) do update set data = excluded.data, user_id = excluded.user_id`, [r.id, r.user_id, r.data]);
    return;
  }
  if (usingSupabase()) {
    const { error } = await supa().from(t).upsert(rows.map(toRow));
    if (error) throw new Error(`supabase ${t}: ${error.message}`);
    return;
  }
  const db = load();
  for (const row of rows) {
    const i = db[t].findIndex((r) => r.id === row.id);
    if (i >= 0) db[t][i] = row; else db[t].push(row);
  }
  save(db);
}

// ---------- users ----------
export async function userByDemoId(demoId: string) {
  return (await all<User>("users")).find((u) => u.demo_id === demoId) ?? null;
}
export const getUser = (id: string) => get<User>("users", id);
export const listUsers = () => all<User>("users");
export async function createUser(demo_id: string, passcode_hash: string) {
  const u: User = { id: newId(), user_id: undefined as any, demo_id, passcode_hash, created_at: now() } as any;
  await put("users", [u]);
  return u;
}
export async function updateUser(id: string, patch: Partial<User>) {
  const u = await getUser(id);
  if (!u) throw new Error("user not found");
  const next = { ...u, ...patch };
  await put("users", [next]);
  return next;
}

// ---------- jobs ----------
export async function listJobs(userId: string) {
  return (await all<Job>("jobs", userId)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
export const getJob = (id: string) => get<Job>("jobs", id);
export async function addJobs(userId: string, jobs: Omit<Job, "id" | "user_id" | "created_at" | "updated_at">[]) {
  const existing = new Set((await all<Job>("jobs", userId)).map((j) => j.url));
  const fresh = jobs.filter((j) => !existing.has(j.url)).map((j) => ({ ...j, id: newId(), user_id: userId, created_at: now(), updated_at: now() }));
  await put("jobs", fresh);
  return fresh as Job[];
}
export async function updateJob(id: string, patch: Partial<Job>) {
  const j = await getJob(id);
  if (!j) throw new Error("job not found");
  const next = { ...j, ...patch, updated_at: now() };
  await put("jobs", [next]);
  return next;
}
export const saveJobs = (jobs: Job[]) => put("jobs", jobs.map((j) => ({ ...j, updated_at: now() })));

// ---------- events (activity feed) ----------
export async function logEvent(user_id: string, kind: string, text: string, job_id?: string) {
  await put("events", [{ id: newId(), user_id, job_id, kind, text, at: now(), created_at: now() } as any]);
}
export async function listEvents(userId: string, jobId?: string) {
  const ev = (await all<Event>("events", userId)).filter((e) => !jobId || e.job_id === jobId);
  return ev.sort((a, b) => b.at.localeCompare(a.at));
}

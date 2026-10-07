import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getUser } from "./db";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me");
const COOKIE = "jp_session";

export async function hashPasscode(pass: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(pass, salt, 32)).toString("hex")}`;
}
export async function checkPasscode(pass: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const got = await scrypt(pass, salt, 32);
  return crypto.timingSafeEqual(got, Buffer.from(hash, "hex"));
}

export async function startSession(userId: string) {
  const token = await new SignJWT({ uid: userId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return await getUser(payload.uid as string);
  } catch {
    return null;
  }
}

// Approval links: a 72h token for ONE job, so the email button opens the review page on any device without signing in.
export async function jobToken(userId: string, jobId: string) {
  return new SignJWT({ uid: userId, jid: jobId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("72h").sign(secret);
}
export async function verifyJobToken(token: string, jobId: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.jid === jobId ? (payload.uid as string) : null;
  } catch {
    return null;
  }
}

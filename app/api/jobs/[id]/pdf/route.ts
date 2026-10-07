import { currentUser, verifyJobToken } from "@/lib/auth";
import { getJob, getUser } from "@/lib/db";
import { tailoredPdf } from "@/lib/apply";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job?.tailored) return new Response("Not found", { status: 404 });
  const me = await currentUser();
  const t = new URL(req.url).searchParams.get("t");
  const uid = me?.id === job.user_id ? me.id : t ? await verifyJobToken(t, id) : null;
  if (uid !== job.user_id) return new Response("Unauthorized", { status: 401 });
  const user = (await getUser(uid))!;
  const pdf = await tailoredPdf(user, job);
  const name = `${user.resume.name.replace(/\s+/g, "_")}_${job.company.replace(/\W+/g, "")}.pdf`;
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` } });
}

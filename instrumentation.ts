// Starts the autopilot scheduler once per server process (Node runtime only). Compute is always-on, so it keeps time.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { tick } = await import("./lib/autopilot");
  setInterval(() => void tick(), 5 * 60_000);
  setTimeout(() => void tick(), 30_000);
}

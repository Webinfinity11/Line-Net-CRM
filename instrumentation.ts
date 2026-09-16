/**
 * Internal scheduler. Runs inside the Next.js server process, so no external cron is required.
 * - Mailbox polling every 5 minutes (only when GRAPH_* is configured)
 * - Maintenance order generation once per day (checked hourly)
 * Disable with INTERNAL_CRON=0 (for example when an external scheduler calls /api/cron/* instead).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INTERNAL_CRON === "0") return;
  const g = globalThis as unknown as { __linenetCron?: boolean };
  if (g.__linenetCron) return;
  g.__linenetCron = true;

  const { pollMailbox, isGraphConfigured } = await import("@/lib/graph-mail");
  const { generateDueOrders } = await import("@/lib/schedules");

  let lastScheduleRun = "";
  const tick = async () => {
    try {
      if (isGraphConfigured()) {
        const r = await pollMailbox();
        if (r.ok && r.created > 0) console.log(`[cron] mail: ${r.created} new orders`);
        if (!r.ok) console.error(`[cron] mail: ${r.error}`);
      }
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", hour12: false }).format(new Date()));
      if (lastScheduleRun !== today && hour >= 6) {
        const r = await generateDueOrders(null);
        lastScheduleRun = today;
        if (r.created > 0) console.log(`[cron] schedules: ${r.created} orders created`);
      }
    } catch (e) {
      console.error("[cron] tick failed", e);
    }
  };

  setTimeout(tick, 15_000);
  setInterval(tick, 5 * 60_000);
  console.log("[cron] internal scheduler started");
}

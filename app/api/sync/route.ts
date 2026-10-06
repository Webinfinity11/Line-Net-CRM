import { orderSyncRevision } from "@/lib/order-sync";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const headers = { "Cache-Control": "private, no-store, no-transform" };

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  const initial = await orderSyncRevision(session.user.id);
  if (initial === null) return Response.json({ error: "forbidden" }, { status: 403, headers });

  // Short requests remain available when a proxy/browser cannot stream SSE.
  if (new URL(request.url).searchParams.get("transport") === "poll") {
    return Response.json({ revision: initial }, { headers });
  }

  let stop = (_cancelled = false) => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let previous = initial;
      let timer: ReturnType<typeof setTimeout>;
      let lifetime: ReturnType<typeof setTimeout>;
      const onAbort = () => stop();
      stop = (cancelled = false) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        clearTimeout(lifetime);
        request.signal.removeEventListener("abort", onAbort);
        if (!cancelled) controller.close();
      };
      const send = (revision: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ revision })}\n\n`));
      const tick = async () => {
        try {
          const revision = await orderSyncRevision(session.user.id);
          if (closed) return;
          if (revision === null) { stop(); return; }
          if (revision !== previous) {
            send(revision);
            previous = revision;
          } else {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
          timer = setTimeout(() => void tick(), 2_000);
        } catch {
          // EventSource reconnects; the next snapshot catches missed changes.
          stop();
        }
      };
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) { stop(); return; }
      controller.enqueue(encoder.encode("retry: 1000\n\n"));
      send(initial);
      timer = setTimeout(() => void tick(), 2_000);
      // Rotate before serverless timeouts, rechecking the session on reconnect.
      lifetime = setTimeout(stop, 25_000);
    },
    cancel() { stop(true); },
  });
  return new Response(stream, {
    headers: { ...headers, "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" },
  });
}

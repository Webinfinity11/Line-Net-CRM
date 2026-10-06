"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** One subscription for the whole authenticated app, including its counters. */
export function LiveOrderSync() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false);
  const requested = useRef(false);
  const refresh = useRef(() => {});

  refresh.current = () => {
    requested.current = true;
    if (refreshing.current) return;
    requested.current = false;
    refreshing.current = true;
    startTransition(() => router.refresh());
  };
  useEffect(() => {
    refreshing.current = pending;
    if (!pending && requested.current) refresh.current();
  }, [pending]);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let revision: string | null = null;
    let pollTimer: ReturnType<typeof setTimeout>;
    let debounce: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    let streaming = false;
    let generation = 0;
    const receive = (next: unknown) => {
      if (disposed || typeof next !== "string" || next === revision) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        revision = next;
        refresh.current();
      }, 100);
    };
    const poll = async (connection: number) => {
      if (disposed || connection !== generation || document.visibilityState !== "visible") return;
      if (!streaming) {
        const attempt = new AbortController();
        controller = attempt;
        const timeout = setTimeout(() => attempt.abort(), 8_000);
        try {
          const response = await fetch("/api/sync?transport=poll", { cache: "no-store", signal: attempt.signal });
          if (disposed || connection !== generation) return;
          if (response.status === 401 || response.status === 403 || response.redirected) {
            source?.close();
            refresh.current();
            return;
          }
          if (response.ok) {
            const data = await response.json();
            if (connection === generation) receive(data.revision);
          }
        } catch { /* Reconnect after a temporary network failure. */ }
        finally { clearTimeout(timeout); }
      }
      if (!disposed && connection === generation) pollTimer = setTimeout(() => void poll(connection), 3_000);
    };
    const disconnect = () => {
      generation++;
      source?.close();
      source = null;
      streaming = false;
      controller?.abort();
      clearTimeout(pollTimer);
      clearTimeout(debounce);
    };
    const connect = () => {
      disconnect();
      if (disposed || document.visibilityState !== "visible") return;
      const connection = generation;
      if ("EventSource" in window) {
        source = new EventSource("/api/sync");
        source.onmessage = (event) => {
          streaming = true;
          try { receive(JSON.parse(event.data).revision); } catch { /* Ignore malformed events. */ }
        };
        source.onerror = () => { streaming = false; };
      }
      pollTimer = setTimeout(() => void poll(connection), 3_000);
    };
    // The first snapshot refreshes once, covering changes between page render
    // and subscription, as well as stale prefetched/back-navigation pages.
    connect();
    document.addEventListener("visibilitychange", connect);
    window.addEventListener("online", connect);
    return () => {
      disposed = true;
      disconnect();
      document.removeEventListener("visibilitychange", connect);
      window.removeEventListener("online", connect);
    };
  }, [pathname, search]);

  return null;
}

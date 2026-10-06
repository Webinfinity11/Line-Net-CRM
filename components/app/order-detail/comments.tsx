"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { markOrderCommentsRead } from "@/actions/notifications";
import { addComment } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../user-avatar";

type Comment = { id: number; body: string; createdAt: Date; user: { id: string; name: string; image: string | null } | null };
type Message = Comment & { pending?: boolean };
type ApiComment = Omit<Comment, "createdAt"> & { createdAt: string };

const POLL_MS = 10_000;
/** Closer than this to the bottom counts as "reading the latest", so new messages scroll into view. */
const STICK_PX = 80;
/** About five lines of 16px text plus padding. */
const MAX_INPUT_PX = 136;

function maxId(list: { id: number }[]) {
  return list.reduce((m, c) => (c.id > m ? c.id : m), 0);
}

/** Server rows by id in ascending order; unsent (negative id) bubbles stay last. */
function merge(prev: Message[], incoming: Comment[]): Message[] {
  const byId = new Map<number, Message>();
  for (const m of prev) if (m.id > 0) byId.set(m.id, m);
  for (const c of incoming) byId.set(c.id, c);
  const saved = [...byId.values()].sort((a, b) => a.id - b.id);
  return [...saved, ...prev.filter((m) => m.id < 0)];
}

export function Comments({ orderId, comments, meId }: { orderId: number; comments: Comment[]; meId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(comments);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const forceScroll = useRef(false);
  const lastId = useRef(maxId(comments));

  const me = comments.find((c) => c.user?.id === meId)?.user ?? { id: meId, name: "მე", image: null };

  // A router.refresh() brings a fresh server list; fold it in without dropping unsent bubbles.
  useEffect(() => {
    lastId.current = Math.max(lastId.current, maxId(comments));
    setMessages((prev) => merge(prev, comments));
  }, [comments]);

  const markRead = useCallback(async () => {
    try {
      const res = await markOrderCommentsRead(orderId);
      if (res.ok && (res.data?.marked ?? 0) > 0) router.refresh(); // the bell count follows
    } catch {
      // best effort; the bell catches up on its own poll
    }
  }, [orderId, router]);

  useEffect(() => {
    void markRead();
  }, [markRead]);

  useEffect(() => {
    let disposed = false;
    let polling = false;
    const controller = new AbortController();

    async function poll() {
      if (disposed || polling || document.visibilityState !== "visible") return;
      polling = true;
      try {
        const res = await fetch(`/api/orders/${orderId}/comments?since=${lastId.current}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok || res.redirected) return;
        const data = (await res.json()) as { items: ApiComment[]; nextSince: number };
        if (disposed) return;
        if (typeof data.nextSince === "number") lastId.current = Math.max(lastId.current, data.nextSince);
        if (!data.items?.length) return;
        const items: Comment[] = data.items.map((c) => ({ ...c, createdAt: new Date(c.createdAt) }));
        setMessages((prev) => merge(prev, items));
        if (items.some((c) => c.user?.id !== meId)) void markRead();
      } catch {
        // offline or aborted; the next tick retries
      } finally {
        polling = false;
      }
    }

    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisibility = () => void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderId, meId, markRead]);

  // Runs before paint: on mount and whenever the list grows, keep the latest message in view
  // if the reader was already at the bottom or just sent it.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stick.current || forceScroll.current) el.scrollTop = el.scrollHeight;
    forceScroll.current = false;
  }, [messages.length]);

  function onScroll() {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_PX;
  }

  function resize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
  }

  useLayoutEffect(resize, [text]);

  async function send() {
    const body = text;
    if (!body.trim() || sending) return;
    const tempId = -Date.now();
    setSending(true);
    setText("");
    forceScroll.current = true;
    setMessages((prev) => [...prev, { id: tempId, body, createdAt: new Date(), user: me, pending: true }]);
    try {
      const res = await addComment(orderId, body);
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setText((current) => current || body);
        toast.error(res.error);
        return;
      }
      const saved = res.data;
      setMessages((prev) => {
        if (!saved) return prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m));
        // A poll may have brought the saved row already.
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tempId);
        const rest = prev.filter((m) => m.id !== tempId);
        return merge(rest, [{ id: saved.id, body, createdAt: new Date(saved.createdAt), user: me }]);
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText((current) => current || body);
      toast.error("შეტყობინება ვერ გაიგზავნა");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const count = messages.filter((m) => !m.pending).length;

  return (
    <Card id="comments" className="scroll-mt-[72px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t.order.comments} <span className="ml-1 text-sm font-normal text-muted-foreground">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={listRef} onScroll={onScroll} className="max-h-[480px] min-w-0 space-y-3 overflow-y-auto overscroll-contain">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">შეტყობინება ჯერ არ არის. დაწერეთ პირველი.</p>}
          {messages.map((m) => {
            const mine = m.user?.id === meId;
            return (
              <div key={m.id} className={cn("flex min-w-0 items-end gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && <UserAvatar name={m.user?.name ?? "?"} image={m.user?.image} size="sm" className="shrink-0" />}
                <div
                  className={cn(
                    "min-w-0 max-w-[85%] rounded-[16px] px-3 py-2 text-sm",
                    mine ? "bg-accent" : "bg-muted",
                    m.pending && "opacity-70",
                  )}
                >
                  <div className="mb-0.5 truncate text-[11px] text-muted-foreground">
                    {m.user?.name ?? "—"} · {formatDate(m.createdAt, true)}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="დაწერეთ შეტყობინება…"
            aria-label="შეტყობინება"
            className="max-h-[136px] min-h-11 min-w-0 flex-1 resize-none text-[16px] sm:min-h-10 sm:text-[14px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button type="submit" size="icon" className="size-11 shrink-0 sm:size-10" disabled={!text.trim() || sending} aria-label="გაგზავნა">
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

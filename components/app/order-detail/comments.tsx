"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { addComment } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../user-avatar";

type Comment = { id: number; body: string; createdAt: Date; user: { id: string; name: string; image: string | null } | null };

export function Comments({ orderId, comments, meId }: { orderId: number; comments: Comment[]; meId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = ref.current?.value ?? "";
    if (!body.trim()) return;
    start(async () => {
      const res = await addComment(orderId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (ref.current) ref.current.value = "";
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t.order.comments} <span className="ml-1 text-sm font-normal text-muted-foreground">{comments.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">კომენტარები ჯერ არ არის</p>}
          {comments.map((c) => {
            const mine = c.user?.id === meId;
            return (
              <div key={c.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                <UserAvatar name={c.user?.name ?? "?"} image={c.user?.image} size="md" />
                <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", mine ? "bg-sky-600 text-white" : "bg-neutral-100 dark:bg-neutral-800")}>
                  <div className={cn("mb-0.5 text-[11px]", mine ? "text-sky-100" : "text-muted-foreground")}>
                    {c.user?.name ?? "—"} · {formatDate(c.createdAt, true)}
                  </div>
                  <div className="whitespace-pre-wrap">{c.body}</div>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <Textarea
            ref={ref}
            rows={2}
            placeholder="დაწერეთ კომენტარი..."
            className="min-h-10 flex-1 resize-none"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
            }}
          />
          <Button type="submit" size="icon" className="self-end bg-sky-600 hover:bg-sky-700" disabled={pending} aria-label="გაგზავნა">
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

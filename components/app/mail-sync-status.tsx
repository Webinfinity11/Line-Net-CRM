"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { pollMailNow } from "@/actions/mail";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n";

export function MailSyncStatus({
  state,
}: {
  state: { configured: false } | { configured: true; mailbox: string; lastRunAt: Date | null; lastError: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!state.configured) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Microsoft 365 ყუთი არ არის დაკავშირებული. იხ. docs/03-microsoft-365-setup.md
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white px-3 py-2 text-xs dark:bg-neutral-900">
      <span className="font-medium">{state.mailbox}</span>
      <span className="text-muted-foreground">ბოლო შემოწმება: {state.lastRunAt ? formatDate(state.lastRunAt, true) : "—"}</span>
      {state.lastError && <span className="text-rose-600">შეცდომა: {state.lastError.slice(0, 120)}</span>}
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await pollMailNow();
            if (!res.ok) toast.error(res.error);
            else toast.success(`შემოწმდა: ${res.data!.fetched} წერილი, ${res.data!.created} ახალი`);
            router.refresh();
          })
        }
      >
        <RefreshCw className={pending ? "size-3 animate-spin" : "size-3"} /> შემოწმება ახლა
      </Button>
    </div>
  );
}

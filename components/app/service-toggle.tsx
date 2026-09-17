"use client";

import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setServiceActive } from "@/actions/services";
import { Button } from "@/components/ui/button";

/** `compact` is for the phone list, where a row has no space for three labelled buttons. */
export function ToggleActive({ id, active, compact }: { id: number; active: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={active ? "გამორთვა" : "ჩართვა"}
      className={compact ? "size-10 p-0" : undefined}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setServiceActive(id, !active);
          if (!res.ok) toast.error(res.error);
          else toast.success(active ? "გამოირთო" : "ჩაირთო");
          router.refresh();
        })
      }
    >
      <Power className={compact ? "size-4" : "size-3.5"} />
      {!compact && (active ? "გამორთვა" : "ჩართვა")}
    </Button>
  );
}

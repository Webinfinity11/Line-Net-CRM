"use client";

import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setServiceActive } from "@/actions/services";
import { Button } from "@/components/ui/button";

export function ToggleActive({ id, active }: { id: number; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
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
      <Power className="size-3.5" /> {active ? "გამორთვა" : "ჩართვა"}
    </Button>
  );
}

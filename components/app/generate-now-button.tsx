"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateNow } from "@/actions/schedules";
import { Button } from "@/components/ui/button";

export function GenerateNowButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await generateNow();
          if (!res.ok) toast.error(res.error);
          else toast.success(`შეიქმნა ${res.data!.created} შეკვეთა${res.data!.skipped ? `, ${res.data!.skipped} უკვე არსებობდა` : ""}`);
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> გენერაცია ახლა
    </Button>
  );
}

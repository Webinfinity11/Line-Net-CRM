"use client";

import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { setSystemActive, updateSystem } from "@/actions/systems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SystemOption } from "./systems-provider";

/** One editable row: name and position save on blur, visibility on the button. */
export function SystemRow({ system, usage }: { system: SystemOption; usage: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = useRef(false);

  function save(next: { name?: string; sort?: number; active?: boolean }) {
    const name = next.name ?? system.name;
    const sort = next.sort ?? system.sort;
    const active = next.active ?? system.active;
    if (name === system.name && sort === system.sort && active === system.active) return;
    if (busy.current) return;
    busy.current = true;
    const fd = new FormData();
    fd.set("key", system.key);
    fd.set("name", name);
    fd.set("sort", String(sort));
    fd.set("active", String(active));
    start(async () => {
      try {
        const res = await updateSystem(fd);
        if (!res.ok) toast.error(res.error);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#eef1f6] py-3 first:border-t-0">
      <Input
        defaultValue={system.name}
        aria-label={`${system.name} დასახელება`}
        className="h-11 min-w-0 flex-1 text-[16px] sm:h-9 sm:text-[13px]"
        onBlur={(e) => save({ name: e.target.value.trim() })}
      />
      <Input
        type="number"
        min="0"
        max="9999"
        defaultValue={system.sort}
        aria-label={`${system.name} რიგითობა`}
        className="h-11 w-20 text-[16px] sm:h-9 sm:text-[13px]"
        onBlur={(e) => save({ sort: Number(e.target.value) })}
      />
      <span className="tabular w-[104px] shrink-0 text-[11.5px] text-muted-foreground">{usage} შეკვეთა</span>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className="h-11 sm:h-9"
        onClick={() =>
          start(async () => {
            const res = await setSystemActive(system.key, !system.active);
            if (!res.ok) toast.error(res.error);
            else toast.success(system.active ? "დაიმალა" : "ჩაირთო");
            router.refresh();
          })
        }
      >
        <Power className="size-3.5" /> {system.active ? "დამალვა" : "ჩართვა"}
      </Button>
    </div>
  );
}

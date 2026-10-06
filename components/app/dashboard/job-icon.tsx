import { Cable, Camera, DoorOpen, Flame, Lightbulb, Network, PenTool, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { SystemType } from "@/db/schema";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<SystemType, LucideIcon>> = {
  cctv: Camera,
  fire: Flame,
  access: DoorOpen,
  network: Network,
  electrical: Zap,
  lighting: Lightbulb,
  design: PenTool,
  cable_trays: Cable,
};

export function JobIcon({ system, className }: { system: SystemType | null; className?: string }) {
  const Icon = (system && ICONS[system]) || Wrench;
  return (
    <span className={cn("grid size-[30px] shrink-0 place-items-center rounded-[7px] bg-muted text-[#66809a] dark:text-muted-foreground", className)} aria-hidden>
      <Icon className="size-4 [stroke-width:1.7]" />
    </span>
  );
}

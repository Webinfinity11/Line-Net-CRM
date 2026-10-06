"use client";

import { ChevronDown, FileCheck, FileText, Mail, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const ICONS = { sheet: Printer, act: FileCheck, invoice: FileText, mail: Mail } as const;
export type OrderDocument = { kind: keyof typeof ICONS; href: string; label: string; newTab?: boolean };

/**
 * The order's printouts sit behind one button: they are opened now and then, while editing is the
 * everyday action. A single document stays a plain button, a menu of one would only add a click.
 */
export function DocumentsMenu({ items, className }: { items: OrderDocument[]; className?: string }) {
  if (items.length === 0) return null;
  if (items.length === 1) {
    const [only] = items;
    const Icon = ICONS[only.kind];
    return (
      <Button render={<Link href={only.href} target={only.newTab ? "_blank" : undefined} />} variant="outline" size="sm" className={className}>
        <Icon className="size-3.5" /> {only.label}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className={className} />}>
        <FileText className="size-3.5" /> დოკუმენტები <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-sm:w-[calc(100vw-16px)]">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <DropdownMenuItem key={item.kind} render={<Link href={item.href} target={item.newTab ? "_blank" : undefined} />} className="min-h-[44px] gap-2 md:min-h-9">
              <Icon className="size-4 text-muted-foreground" /> {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

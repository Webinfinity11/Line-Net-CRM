"use client";

import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Pencil, SquareArrowOutUpRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AssignDialog, AssignForm, type ExecutorOption } from "@/components/app/assign-form";
import { PaymentBadge, StatusBadge, SystemBadge } from "@/components/app/badges";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { OrderPriority, OrderStatus, PaymentStatus, SystemType } from "@/db/schema";
import { formatMoney, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BulkAssignDialog } from "./bulk-assign-dialog";
import { toMtavruli } from "@/lib/mtavruli";

/** Serializable row: dates are already formatted on the server. */
export type OrderRow = {
  id: number;
  number: string;
  title: string;
  status: OrderStatus;
  priority: OrderPriority;
  systemType: SystemType | null;
  client: string | null;
  site: string | null;
  dueLabel: string | null;
  overdue: boolean;
  assignees: { id: string; name: string; image: string | null }[];
  amount: string | null;
  paymentStatus: PaymentStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  plannedMinutes: number | null;
};

const firstName = (n: string) => n.split(" ")[0];

/** Row actions, shared by the desktop table and the phone cards. */
function RowMenu({ o, onAssign }: { o: OrderRow; onAssign: (o: OrderRow) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${o.number} მოქმედებები`} />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={`/orders/${o.id}`} />}>
            <SquareArrowOutUpRight className="size-4" /> გახსნა
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAssign(o)}>
            <UserPlus className="size-4" /> დანიშვნა
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/orders/${o.id}/edit`} />}>
            <Pencil className="size-4" /> რედაქტირება
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`/orders/${o.id}/sheet`} target="_blank" rel="noreferrer" />}>
            <FileText className="size-4" /> სამუშაო ფურცელი
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Phone row: one tappable card, no horizontal scrolling, actions in the thumb zone. */
function OrderCardRow({ o, onAssign }: { o: OrderRow; onAssign: (o: OrderRow) => void }) {
  const lead = o.assignees[0];
  return (
    <li className="relative border-t border-[#eef1f6] first:border-t-0">
      <Link href={`/orders/${o.id}`} className="block px-4 py-3.5 pr-12 active:bg-[#f8faff]">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug text-foreground">{o.title}</span>
            <span className="mt-1 block truncate text-[12.5px] text-muted-foreground">
              {o.number}
              {o.client ? ` · ${o.client}` : ""}
              {o.site ? ` · ${o.site}` : ""}
            </span>
          </span>
          {o.priority === "urgent" && <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-[#b13f32]">სასწრაფო</span>}
        </span>
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
          <StatusBadge status={o.status} />
          <span className={cn("text-muted-foreground", o.overdue && "font-semibold text-[#b13f32]")}>
            {o.dueLabel ? `ვადა ${o.dueLabel}` : "ვადის გარეშე"}
          </span>
          <span className="text-muted-foreground">{lead ? firstName(lead.name) : "დაუნიშნავი"}</span>
          {o.amount && <span className="tabular ml-auto font-medium text-foreground">{formatMoney(o.amount)}</span>}
        </span>
      </Link>
      <span className="absolute right-2 top-2.5">
        <RowMenu o={o} onAssign={onAssign} />
      </span>
    </li>
  );
}

export function OrdersTable({
  rows,
  executors,
  normHours,
  today,
  page,
  pages,
  prevHref,
  nextHref,
}: {
  rows: OrderRow[];
  executors: ExecutorOption[];
  normHours: number;
  today: string;
  page: number;
  pages: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [assignRow, setAssignRow] = useState<OrderRow | null>(null);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(ids));
  const clear = () => setSelected(new Set());

  const th = "px-3 py-3 text-left text-[11px] font-normal text-muted-foreground sm:px-4";
  const td = "px-3 py-[14px] align-middle sm:px-4";

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="sticky top-[68px] z-10 hidden flex-wrap items-center gap-3 sm:flex rounded-lg border border-[#dbe3fd] bg-[#eef2ff] px-4 py-2 text-[12px] text-[#3457d5]">
          <span className="font-medium">არჩეულია {selected.size}</span>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <UserPlus className="size-3.5" /> ჯგუფური დანიშვნა
          </Button>
          <button type="button" onClick={clear} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {toMtavruli("მონიშვნის მოხსნა")}
          </button>
        </div>
      )}

      <div className="overflow-hidden ln-card">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-[13px] text-muted-foreground">{t.common.noResults}</p>
        ) : (
          <>
          <ul className="sm:hidden">
            {rows.map((o) => (
              <OrderCardRow key={o.id} o={o} onAssign={setAssignRow} />
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-[13px]">
              <thead className="bg-[#fbfcfe]">
                <tr>
                  <th className="hidden w-10 px-3 py-3 sm:table-cell sm:px-4">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="ყველას მონიშვნა" />
                  </th>
                  <th className={cn(th, "hidden sm:table-cell")}>{t.order.number}</th>
                  <th className={th}>{t.order.title}</th>
                  <th className={cn(th, "hidden lg:table-cell")}>{t.order.system}</th>
                  <th className={cn(th, "hidden md:table-cell")}>{t.order.assignees}</th>
                  <th className={cn(th, "hidden md:table-cell")}>{t.order.dueDate}</th>
                  <th className={th}>{t.order.status}</th>
                  <th className={cn(th, "hidden text-right lg:table-cell")}>{t.order.amount}</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const lead = o.assignees[0];
                  return (
                    <tr key={o.id} className={cn("border-t border-[#eef1f6] transition-colors hover:bg-[#f8faff]", selected.has(o.id) && "bg-[#f4f7ff]")}>
                      <td className="hidden px-3 py-[14px] sm:table-cell sm:px-4">
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} aria-label={`${o.number} მონიშვნა`} />
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:table-cell")}>{o.number}</td>
                      <td className={cn(td, "max-w-[160px] sm:max-w-[260px]")}>
                        <Link href={`/orders/${o.id}`} className="block">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-foreground hover:text-[#3457d5]">{o.title}</span>
                            {o.priority === "urgent" && <span className="shrink-0 text-[10px] font-semibold text-[#b13f32]">სასწრაფო</span>}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {[o.client, o.site].filter(Boolean).join(" · ") || "—"}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground md:hidden">
                            {lead ? firstName(lead.name) : "დაუნიშნავი"}
                            {o.dueLabel ? ` · ვადა ${o.dueLabel}` : ""}
                            {o.overdue ? <span className="font-medium text-[#b13f32]"> · {t.order.overdue}</span> : null}
                          </span>
                        </Link>
                      </td>
                      <td className={cn(td, "hidden max-w-[150px] lg:table-cell")}>
                        <span className="block truncate">
                          <SystemBadge system={o.systemType} />
                        </span>
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap md:table-cell")}>
                        {lead ? (
                          <span className="flex items-center gap-1.5">
                            <UserAvatar name={lead.name} image={lead.image} size="sm" />
                            {firstName(lead.name)}
                            {o.assignees.length > 1 && <span className="text-muted-foreground">+{o.assignees.length - 1}</span>}
                          </span>
                        ) : (
                          <AssignDialog
                            orderId={o.id}
                            title={o.title}
                            systemType={o.systemType}
                            executors={executors}
                            normHours={normHours}
                            defaultAssigneeId={null}
                            defaultDate={o.scheduledDate ?? today}
                            defaultTime={o.scheduledTime}
                            defaultMinutes={o.plannedMinutes}
                            label="დანიშვნა"
                            variant="ghost"
                            size="xs"
                          />
                        )}
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap md:table-cell", o.overdue && "font-semibold text-[#b13f32]")} title={o.overdue ? t.order.overdue : undefined}>
                        {o.dueLabel ?? "—"}
                        {o.overdue && <span className="sr-only"> {t.order.overdue}</span>}
                      </td>
                      <td className={cn(td, "whitespace-nowrap")}>
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={cn(td, "hidden whitespace-nowrap text-right lg:table-cell")}>
                        <span className="tabular block">{formatMoney(o.amount)}</span>
                        {o.amount && <PaymentBadge status={o.paymentStatus} className="mt-0.5 px-1.5 py-0 text-[10px]" />}
                      </td>
                      <td className="px-2 py-[14px] text-right">
                        <RowMenu o={o} onAssign={setAssignRow} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-end gap-2 border-t border-[#eef1f6] px-4 py-2.5 text-[12px]" aria-label="გვერდები">
            <span className="text-muted-foreground">
              გვერდი <span className="tabular font-medium text-foreground">{page}</span> / {pages}
            </span>
            <Button render={prevHref ? <Link href={prevHref} /> : <span />} variant="outline" size="icon-sm" aria-label="წინა გვერდი" disabled={!prevHref}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button render={nextHref ? <Link href={nextHref} /> : <span />} variant="outline" size="icon-sm" aria-label="შემდეგი გვერდი" disabled={!nextHref}>
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        )}
      </div>

      <BulkAssignDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        orderIds={[...selected]}
        executors={executors}
        normHours={normHours}
        defaultDate={today}
        onDone={clear}
      />

      <Dialog open={!!assignRow} onOpenChange={(open) => !open && setAssignRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-medium">დანიშვნა</DialogTitle>
            <DialogDescription>{assignRow?.title}</DialogDescription>
          </DialogHeader>
          {assignRow && (
            <AssignForm
              orderId={assignRow.id}
              systemType={assignRow.systemType}
              executors={executors}
              normHours={normHours}
              defaultAssigneeId={assignRow.assignees[0]?.id ?? null}
              defaultDate={assignRow.scheduledDate ?? today}
              defaultTime={assignRow.scheduledTime}
              defaultMinutes={assignRow.plannedMinutes}
              onDone={() => setAssignRow(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

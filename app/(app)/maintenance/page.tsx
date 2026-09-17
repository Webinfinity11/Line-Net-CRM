import { CalendarSync, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { createSchedule, deleteSchedule, toggleSchedule, updateSchedule } from "@/actions/schedules";
import { SystemBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { GenerateNowButton } from "@/components/app/generate-now-button";
import { PageHeader } from "@/components/app/page-header";
import { ScheduleFields } from "@/components/app/schedule-form";
import { DataList, DataRow, EmptyState, tableCls } from "@/components/app/section-card";
import { AvatarStack } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { listTemplates } from "@/lib/checklists";
import { FREQUENCY_LABELS, formatDate, formatMoney, t } from "@/lib/i18n";
import { listAssignableUsers, listClientsWithSites } from "@/lib/orders";
import { listSchedules } from "@/lib/schedules";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "ტექმომსახურება" };

export default async function MaintenancePage() {
  const me = await requireUser(["admin", "manager"]);
  const [schedules, clients, users, templates] = await Promise.all([listSchedules(), listClientsWithSites(), listAssignableUsers(), listTemplates()]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name, sites: c.sites.map((s) => ({ id: s.id, name: s.name })) }));
  const tplOptions = templates.map((x) => ({ id: x.id, name: x.name, systemType: x.systemType }));
  const active = schedules.filter((s) => s.active);
  const inactive = schedules.filter((s) => !s.active);

  const Actions = ({ s, labelled = false }: { s: (typeof schedules)[number]; labelled?: boolean }) => (
    <>
      <FormDialog
        trigger={<Button variant="ghost" size={labelled ? "sm" : "icon-xs"} className={labelled ? "h-10" : undefined} aria-label="რედაქტირება" />}
        triggerLabel={labelled ? <><Pencil className="size-3.5" /> რედაქტირება</> : <Pencil className="size-3.5" />}
        title="გრაფიკის რედაქტირება"
        action={updateSchedule.bind(null, s.id)}
      >
        <ScheduleFields clients={clientOptions} users={users} templates={tplOptions} initial={s} />
      </FormDialog>
      <ConfirmButton
        title={s.active ? "გრაფიკის გაჩერება" : "გრაფიკის ჩართვა"}
        description={s.active ? "შეკვეთები აღარ შეიქმნება, სანამ ისევ არ ჩართავთ." : "შეკვეთები ისევ შეიქმნება გრაფიკით."}
        confirmLabel={s.active ? "გაჩერება" : "ჩართვა"}
        variant="ghost"
        size={labelled ? "sm" : "xs"}
        className={labelled ? "h-10" : undefined}
        action={toggleSchedule.bind(null, s.id, !s.active)}
      >
        {s.active ? "გაჩერება" : "ჩართვა"}
      </ConfirmButton>
      {me.role === "admin" && (
        <ConfirmButton
          title="გრაფიკის წაშლა"
          description="უკვე შექმნილი შეკვეთები რჩება."
          confirmLabel={t.common.delete}
          variant="ghost"
          size={labelled ? "sm" : "xs"}
          className={labelled ? "h-10" : undefined}
          action={deleteSchedule.bind(null, s.id)}
        >
          <Trash2 className="size-3.5 text-muted-foreground" />
          {labelled ? <span>{t.common.delete}</span> : null}
        </ConfirmButton>
      )}
    </>
  );

  const Card = ({ s }: { s: (typeof schedules)[number] }) => (
    <DataRow
      key={s.id}
      title={
        <span className={cn(!s.active && "opacity-60")}>
          {s.title}
          {!s.active && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(გაჩერებული)</span>}
        </span>
      }
      meta={
        <>
          <div>
            {s.client.name}
            {s.site ? ` · ${s.site.name}` : ""}
          </div>
          <div>
            {FREQUENCY_LABELS[s.frequency]} · შემდეგი {formatDate(s.nextDate)}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <AvatarStack users={s.assigneeIds.map((id) => userMap.get(id)).filter((u): u is NonNullable<typeof u> => Boolean(u))} />
            <span className="tabular">{formatMoney(s.amount)}</span>
          </div>
        </>
      }
      actions={<Actions s={s} labelled />}
    />
  );

  const Row = ({ s }: { s: (typeof schedules)[number] }) => (
    <tr className={cn(tableCls.row, !s.active && "opacity-55")}>
      <td className={tableCls.td}>
        <div className="font-medium">{s.title}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {s.client.name}
          {s.site ? ` · ${s.site.name}` : ""}
        </div>
      </td>
      <td className={cn(tableCls.td, "hidden lg:table-cell")}>
        <SystemBadge system={s.systemType} />
      </td>
      <td className={cn(tableCls.td, "hidden whitespace-nowrap text-muted-foreground md:table-cell")}>{FREQUENCY_LABELS[s.frequency]}</td>
      <td className={cn(tableCls.td, "whitespace-nowrap font-medium tabular")}>{formatDate(s.nextDate)}</td>
      <td className={cn(tableCls.td, "hidden sm:table-cell")}>
        <AvatarStack users={s.assigneeIds.map((id) => userMap.get(id)).filter((u): u is NonNullable<typeof u> => Boolean(u))} />
      </td>
      <td className={cn(tableCls.tdRight, "hidden sm:table-cell")}>{formatMoney(s.amount)}</td>
      <td className={cn(tableCls.td, "hidden whitespace-nowrap text-[11px] text-muted-foreground xl:table-cell")}>{s.lastGeneratedAt ? formatDate(s.lastGeneratedAt) : "—"}</td>
      <td className={cn(tableCls.td, "text-right")}>
        <div className="flex justify-end gap-1">
          <Actions s={s} />
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav2.maintenance}
        subtitle={`${active.length} აქტიური გრაფიკი · სისტემა თვითონ ქმნის შეკვეთას ვადამდე რამდენიმე დღით ადრე`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GenerateNowButton />
            <FormDialog
              trigger={<Button />}
              triggerLabel={
                <>
                  <Plus className="size-4" /> ახალი გრაფიკი
                </>
              }
              title="ახალი გრაფიკი"
              action={createSchedule}
              submitLabel={t.common.create}
            >
              <ScheduleFields clients={clientOptions} users={users} templates={tplOptions} />
            </FormDialog>
          </div>
        }
      />

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarSync}
          message="გრაფიკები არ არის. დაამატეთ პირველი: მაგალითად სახანძრო სისტემის ყოველთვიური შემოწმება."
          className="ln-card border-transparent py-16"
        />
      ) : (
        <div className={cn(tableCls.wrap, "ln-enter")}>
          <DataList className="px-4 py-2">
            {[...active, ...inactive].map((s) => (
              <Card key={s.id} s={s} />
            ))}
          </DataList>
          <div className={cn(tableCls.scroll, "hidden sm:block")}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>გრაფიკი</th>
                  <th className={cn(tableCls.th, "hidden lg:table-cell")}>სისტემა</th>
                  <th className={cn(tableCls.th, "hidden md:table-cell")}>სიხშირე</th>
                  <th className={tableCls.th}>შემდეგი</th>
                  <th className={cn(tableCls.th, "hidden sm:table-cell")}>შემსრულებლები</th>
                  <th className={cn(tableCls.thRight, "hidden sm:table-cell")}>თანხა</th>
                  <th className={cn(tableCls.th, "hidden xl:table-cell")}>ბოლო გენერაცია</th>
                  <th className={tableCls.thRight}>{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <Row key={s.id} s={s} />
                ))}
                {inactive.map((s) => (
                  <Row key={s.id} s={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        გრაფიკები ყოველდღე ავტომატურად მოწმდება და ვადის დადგომისას შეკვეთა თავად იქმნება. ასე შექმნილი შეკვეთები{" "}
        <Link href="/orders?status=all" className="text-[#3457d5] hover:underline">
          შეკვეთების სიაში
        </Link>{" "}
        ჩანს წყაროთი „გრაფიკი“.
      </p>
    </div>
  );
}

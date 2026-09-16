import { CalendarSync, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { listTemplates } from "@/actions/order-work";
import { createSchedule, deleteSchedule, toggleSchedule, updateSchedule } from "@/actions/schedules";
import { SystemBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { GenerateNowButton } from "@/components/app/generate-now-button";
import { PageHeader } from "@/components/app/page-header";
import { ScheduleFields } from "@/components/app/schedule-form";
import { AvatarStack } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
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

  const Row = ({ s }: { s: (typeof schedules)[number] }) => (
    <tr className={cn("border-b last:border-0", !s.active && "opacity-60")}>
      <td className="px-4 py-2.5">
        <div className="font-medium">{s.title}</div>
        <div className="text-xs text-muted-foreground">
          {s.client.name}
          {s.site ? ` · ${s.site.name}` : ""}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <SystemBadge system={s.systemType} />
      </td>
      <td className="px-3 py-2.5 text-sm">{FREQUENCY_LABELS[s.frequency]}</td>
      <td className="px-3 py-2.5 text-sm font-medium whitespace-nowrap">{formatDate(s.nextDate)}</td>
      <td className="px-3 py-2.5">
        <AvatarStack users={s.assigneeIds.map((id) => userMap.get(id)).filter((u): u is NonNullable<typeof u> => Boolean(u))} />
      </td>
      <td className="px-3 py-2.5 text-right text-sm whitespace-nowrap">{formatMoney(s.amount)}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{s.lastGeneratedAt ? formatDate(s.lastGeneratedAt) : "—"}</td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-1">
          <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="რედაქტირება" />} triggerLabel={<Pencil className="size-3.5" />} title="გრაფიკის რედაქტირება" action={updateSchedule.bind(null, s.id)}>
            <ScheduleFields clients={clientOptions} users={users} templates={tplOptions} initial={s} />
          </FormDialog>
          <ConfirmButton
            title={s.active ? "გრაფიკის გაჩერება" : "გრაფიკის ჩართვა"}
            description={s.active ? "შეკვეთები აღარ შეიქმნება, სანამ ისევ არ ჩართავთ." : "შეკვეთები ისევ შეიქმნება გრაფიკით."}
            confirmLabel={s.active ? "გაჩერება" : "ჩართვა"}
            variant="ghost"
            size="xs"
            action={toggleSchedule.bind(null, s.id, !s.active)}
          >
            {s.active ? "გაჩერება" : "ჩართვა"}
          </ConfirmButton>
          {me.role === "admin" && (
            <ConfirmButton title="გრაფიკის წაშლა" description="უკვე შექმნილი შეკვეთები რჩება." confirmLabel={t.common.delete} variant="ghost" size="xs" action={deleteSchedule.bind(null, s.id)}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </ConfirmButton>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div>
      <PageHeader
        title={t.nav2.maintenance}
        subtitle="პერიოდული შემოწმებები: სისტემა თვითონ ქმნის შეკვეთას ვადამდე რამდენიმე დღით ადრე, ჩეკ-ლისტით და შემსრულებლებით."
        actions={
          <>
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
          </>
        }
      />

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">გრაფიკი</th>
              <th className="px-3 py-2.5 font-medium">სისტემა</th>
              <th className="px-3 py-2.5 font-medium">სიხშირე</th>
              <th className="px-3 py-2.5 font-medium">შემდეგი</th>
              <th className="px-3 py-2.5 font-medium">შემსრულებლები</th>
              <th className="px-3 py-2.5 text-right font-medium">თანხა</th>
              <th className="px-3 py-2.5 font-medium">ბოლო გენერაცია</th>
              <th className="px-3 py-2.5 text-right font-medium">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted-foreground">
                  <CalendarSync className="mx-auto mb-2 size-8 text-neutral-300" />
                  გრაფიკები არ არის. დაამატეთ პირველი: მაგ. სახანძრო სისტემის ყოველთვიური შემოწმება.
                </td>
              </tr>
            )}
            {active.map((s) => (
              <Row key={s.id} s={s} />
            ))}
            {inactive.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        ავტომატური გენერაცია: cron ყოველდღე იძახებს <code>/api/cron/schedules</code>-ს. გრაფიკით შექმნილი შეკვეთები{" "}
        <Link href="/orders?status=all" className="text-sky-600 hover:underline">
          შეკვეთებში
        </Link>{" "}
        ჩანს წყაროთი „გრაფიკი“.
      </p>
    </div>
  );
}

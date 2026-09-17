import { ClipboardCheck, Clock3, Pencil, Star, Trash2 } from "lucide-react";
import { Plus } from "lucide-react";
import { createTemplate, deleteTemplate, setWorkHoursPerDay, updateTemplate } from "@/actions/templates";
import { SystemBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { Chip, EmptyState, SectionCard } from "@/components/app/section-card";
import { TemplateFields } from "@/components/app/template-forms";
import { WorkHoursForm } from "@/components/app/work-hours-form";
import { Button } from "@/components/ui/button";
import { listTemplates, normalizeItems } from "@/lib/checklists";
import { t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { requireUser } from "@/lib/session";
import { getWorkHoursPerDay } from "@/lib/settings";

export const metadata = { title: "ჩეკ-ლისტები და პარამეტრები" };

export default async function ChecklistSettingsPage() {
  const me = await requireUser(["admin", "manager"]);
  const [templates, hours] = await Promise.all([listTemplates(), getWorkHoursPerDay()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav2.checklists}
        subtitle="შაბლონი ავტომატურად ემატება ახალ შეკვეთას სისტემის მიხედვით. სავალდებულო პუნქტების გარეშე ჩაბარება არ დაიშვება."
        actions={
          <FormDialog trigger={<Button />} triggerLabel={<><Plus className="size-4" /> ახალი შაბლონი</>} title="ახალი შაბლონი" action={createTemplate} submitLabel={t.common.create}>
            <TemplateFields />
          </FormDialog>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          message="შაბლონები არ არის. შექმენით პირველი: მაგალითად „სახანძრო სისტემის ყოველთვიური შემოწმება“ პუნქტებით."
          className="ln-card border-transparent py-16"
        />
      ) : (
        <div className="ln-enter grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => {
            const items = normalizeItems(tpl.items);
            const required = items.filter((i) => i.required).length;
            return (
              <section key={tpl.id} className="ln-card flex min-w-0 flex-col p-6" aria-label={tpl.name}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-[15px] font-semibold leading-snug">{toMtavruli(tpl.name)}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <SystemBadge system={tpl.systemType} />
                      {tpl.isDefault && <Chip tone="accent">ნაგულისხმევი</Chip>}
                      {tpl.requiresPhoto && <Chip tone="warn">ფოტო სავალდებულო</Chip>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <FormDialog trigger={<Button variant="ghost" size="icon-xs" aria-label="შაბლონის რედაქტირება" />} triggerLabel={<Pencil className="size-3.5" />} title="შაბლონის რედაქტირება" action={updateTemplate.bind(null, tpl.id)}>
                      <TemplateFields initial={{ ...tpl, items }} />
                    </FormDialog>
                    {me.role === "admin" && (
                      <ConfirmButton title="შაბლონის წაშლა" description="უკვე შექმნილი შეკვეთების ჩეკ-ლისტები არ იცვლება." confirmLabel={t.common.delete} variant="ghost" size="xs" action={deleteTemplate.bind(null, tpl.id)}>
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </ConfirmButton>
                    )}
                  </div>
                </div>

                <ol className="flex-1 space-y-1.5 border-t border-[#eef1f6] pt-3 text-[12.5px]">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="tabular w-4 shrink-0 text-right text-[11px] text-muted-foreground">{idx + 1}</span>
                      <span className="flex-1">{i.label}</span>
                      {i.required && <Star className="mt-0.5 size-3.5 shrink-0 fill-[#f0c36a] text-[#d9a441]" aria-label="სავალდებულო" />}
                    </li>
                  ))}
                </ol>

                <p className="mt-3 border-t border-[#eef1f6] pt-3 text-[11px] text-muted-foreground">
                  {items.length} პუნქტი · {required} სავალდებულო
                </p>
              </section>
            );
          })}
        </div>
      )}

      {me.role === "admin" && (
        <SectionCard title="სამუშაო დროის ნორმა" icon={Clock3} className="ln-enter ln-enter-2">
          <WorkHoursForm hours={hours} action={setWorkHoursPerDay} />
        </SectionCard>
      )}
    </div>
  );
}

import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { createTemplate, deleteTemplate, setWorkHoursPerDay, updateTemplate } from "@/actions/templates";
import { SystemBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { TemplateFields } from "@/components/app/template-forms";
import { WorkHoursForm } from "@/components/app/work-hours-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listTemplates, normalizeItems } from "@/lib/checklists";
import { t } from "@/lib/i18n";
import { getWorkHoursPerDay } from "@/lib/settings";
import { requireUser } from "@/lib/session";

export const metadata = { title: "ჩეკ-ლისტები და პარამეტრები" };

export default async function ChecklistSettingsPage() {
  const me = await requireUser(["admin", "manager"]);
  const [templates, hours] = await Promise.all([listTemplates(), getWorkHoursPerDay()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav2.checklists}
        subtitle="შაბლონები სისტემების მიხედვით. ნაგულისხმევი შაბლონი ავტომატურად ემატება ახალ შეკვეთას. სავალდებულო პუნქტების გარეშე ჩაბარება არ დაიშვება."
        actions={
          <FormDialog trigger={<Button />} triggerLabel={<><Plus className="size-4" /> ახალი შაბლონი</>} title="ახალი შაბლონი" action={createTemplate} submitLabel={t.common.create}>
            <TemplateFields />
          </FormDialog>
        }
      />

      <div className="grid gap-3 md:grid-cols-2">
        {templates.length === 0 && (
          <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground md:col-span-2">
            შაბლონები არ არის. შექმენით პირველი: მაგ. „სახანძრო სისტემის ყოველთვიური შემოწმება“ პუნქტებით.
          </p>
        )}
        {templates.map((tpl) => {
          const items = normalizeItems(tpl.items);
          return (
            <Card key={tpl.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 pb-1">
                <div className="min-w-0">
                  <CardTitle className="leading-snug">{tpl.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <SystemBadge system={tpl.systemType} />
                    {tpl.isDefault && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-blue-700 ring-1 ring-blue-200">ნაგულისხმევი</span>}
                    {tpl.requiresPhoto && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-200">ფოტო სავალდებულო</span>}
                    <span className="text-muted-foreground">
                      {items.length} პუნქტი · {items.filter((i) => i.required).length} სავალდებულო
                    </span>
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
              </CardHeader>
              <CardContent>
                <ol className="space-y-1 text-sm">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{idx + 1}.</span>
                      <span className="flex-1">{i.label}</span>
                      {i.required && <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="სავალდებულო" />}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {me.role === "admin" && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>სამუშაო დროის ნორმა</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkHoursForm hours={hours} action={setWorkHoursPerDay} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

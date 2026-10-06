import Link from "next/link";
import { Plus } from "lucide-react";
import { createTemplate, deleteTemplate, updateTemplate } from "@/actions/templates";
import { ClientActionsMenu } from "@/components/app/client-actions-menu";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { TemplateFields, TemplateSummary } from "@/components/app/template-forms";
import { Button } from "@/components/ui/button";
import { listTemplates, normalizeItems } from "@/lib/checklists";
import { requireUser } from "@/lib/session";
import { listSystems } from "@/lib/systems";
import { toMtavruli } from "@/lib/mtavruli";

export const metadata = { title: "ჩეკ-ლისტები" };
export default async function ChecklistSettingsPage() {
  await requireUser(["admin"]);
  const [templates, systems] = await Promise.all([listTemplates(), listSystems()]);
  return <div className="space-y-4">
    <PageHeader title="ჩეკ-ლისტები" subtitle="ნაგულისხმევი შაბლონი ემატება მხოლოდ ახალ შეკვეთებს. სავალდებულო პუნქტების გარეშე სამუშაო ვერ ჩაბარდება." actions={
      <FormDialog trigger={<Button className="h-[44px]" />} triggerLabel={<><Plus className="size-4" /> ახალი შაბლონი</>} title="ახალი შაბლონი" action={createTemplate}>
        <TemplateFields systems={systems} />
      </FormDialog>
    } />
    <Link href="/settings/services" className="ln-link inline-flex min-h-[44px] items-center text-[13px]">სერვისები</Link>
    {templates.length === 0 && <p className="ln-card p-6 text-[14px] text-muted-foreground">შაბლონები ჯერ არ არის</p>}
    {systems.filter(s => templates.some(t => t.systemType === s.key)).map(system => <section key={system.key} className="ln-card overflow-hidden">
      <h2 className="px-5 py-4 font-bold text-[15px]">{toMtavruli(system.name)}</h2>
      <div className="divide-y divide-[#eef1f6] dark:divide-border">{templates.filter(t => t.systemType === system.key).map(tpl => {
        const items = normalizeItems(tpl.items);
        return <div key={tpl.id} className="flex items-center gap-2 px-4 py-2">
          <FormDialog trigger={<button className="ln-link min-h-[44px] min-w-0 flex-1 py-2 text-left" />} triggerLabel={<TemplateSummary name={tpl.name} count={items.length} required={items.filter(i => i.required).length} isDefault={tpl.isDefault} />} title="შაბლონის რედაქტირება" action={updateTemplate.bind(null, tpl.id)}>
            <TemplateFields systems={systems} initial={{ ...tpl, items }} />
          </FormDialog>
          <ClientActionsMenu name={tpl.name} editTitle="შაბლონის რედაქტირება" editAction={updateTemplate.bind(null, tpl.id)} secondary={{ label: "წაშლა", title: "შაბლონის წაშლა", description: "შეკვეთებზე არსებული პუნქტები არ შეიცვლება.", destructive: true, action: deleteTemplate.bind(null, tpl.id) }}>
            <TemplateFields systems={systems} initial={{ ...tpl, items }} />
          </ClientActionsMenu>
        </div>;
      })}</div>
    </section>)}
  </div>;
}


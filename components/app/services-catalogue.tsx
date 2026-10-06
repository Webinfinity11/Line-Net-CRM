"use client";

import { useSearchParams } from "next/navigation";
import { Download, Layers, ListChecks, ReceiptText } from "lucide-react";
import Link from "next/link";
import type { Service } from "@/db/schema";
import type { SystemOption } from "@/lib/systems";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/section-card";
import { EditServiceDialog, NewServiceDialog } from "@/components/app/service-forms";
import { ServiceActions } from "@/components/app/service-toggle";
import { NewSubgroupMenu, SubgroupRow, type SubgroupOption } from "@/components/app/subgroup-rows";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { filterServiceCatalogue, groupByServiceSubgroup, NO_SERVICE_CATEGORY, NO_SUBGROUP, serviceCategoryKey } from "@/lib/service-groups";

type CatalogueService = Service & { subgroupName: string | null };

export function ServicesCatalogue({ catalogue, systems, subgroups, admin }: {
  catalogue: CatalogueService[]; systems: SystemOption[]; subgroups: SubgroupOption[];
  admin: boolean;
}) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const cat = searchParams.get("cat") ?? "";
  // Keep filters in the URL: live server refreshes must not overwrite typing.
  function setFilter(key: "q" | "cat", value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  }

  const labels = Object.fromEntries(systems.map(s => [s.key, s.name]));
  const needle = q.trim().toLowerCase();
  const hit = (name: string) => !needle || name.toLowerCase().includes(needle);
  const all = filterServiceCatalogue(catalogue, labels, { q });
  const rows = filterServiceCatalogue(all, labels, { cat });
  const keyOf = (s: CatalogueService) => serviceCategoryKey(s, labels);
  const visibleCategories = systems.filter(s => !cat || cat === s.key).filter(s =>
    rows.some(r => keyOf(r) === s.key) || (s.active && hit(s.name))
    || subgroups.some(sub => sub.systemSlug === s.key && (hit(sub.name) || hit(s.name))));
  const groups = visibleCategories.map(s => ({ key: s.key, name: s.name, items: rows.filter(r => keyOf(r) === s.key) }));
  const ungrouped = rows.filter(r => keyOf(r) === NO_SERVICE_CATEGORY);
  if (ungrouped.length) groups.push({ key: NO_SERVICE_CATEGORY, name: "კატეგორიის გარეშე", items: ungrouped });
  const exportParams = new URLSearchParams({ type: "services" });
  if (q) exportParams.set("q", q);
  if (cat) exportParams.set("cat", cat);
  const defaultSystemType = systems.some(s => s.key === cat) ? cat : undefined;

  return <div className="space-y-4">
    <PageHeader kicker="პარამეტრები" title="სერვისები და ფასები"
      subtitle={`${rows.length} სერვისი · ${rows.filter(r => r.active).length} აქტიური. ეს სია ჩნდება შეკვეთაზე პოზიციის დამატებისას.`}
      actions={<>
        <Button variant="outline" render={<a href={`/api/export?${exportParams}`} />} title="არჩეული სერვისები კატეგორიების ცალკე ფურცლებზე"><Download className="size-4" /> Excel ჯგუფებით</Button>
        {admin && <>
          <Button variant="outline" render={<Link href="/settings/services/categories" />}><Layers className="size-4" /> ჯგუფები</Button>
          <Button variant="outline" render={<Link href="/settings/checklists" />}><ListChecks className="size-4" /> ჩეკ-ლისტები</Button>
        </>}
        <NewServiceDialog defaultSystemType={defaultSystemType} subgroups={subgroups} />
      </>} />
    <div className="flex flex-wrap items-center gap-2">
      <input value={q} onChange={e => setFilter("q", e.target.value)} placeholder="ძებნა: ჯგუფი, ქვეჯგუფი, პოზიცია" aria-label="ძებნა: ჯგუფი, ქვეჯგუფი, პოზიცია"
        className="h-11 min-w-0 basis-full rounded-full border border-border bg-card px-4 text-[16px] outline-none focus:border-primary sm:flex-1 sm:basis-0 sm:text-[13px]" />
      <NativeSelect aria-label="ჯგუფი" value={cat} onChange={e => setFilter("cat", e.target.value)}
        className="h-[44px] w-full sm:w-[240px] [&_button]:h-11 [&_button]:rounded-full [&_button]:bg-white [&_button]:text-[16px] sm:[&_button]:text-[13px]">
        <option value="">ყველა ({all.length})</option>
        {systems.map(s => <option key={s.key} value={s.key}>{s.name} ({all.filter(r => keyOf(r) === s.key).length})</option>)}
        {(catalogue.some(r => keyOf(r) === NO_SERVICE_CATEGORY) || cat === NO_SERVICE_CATEGORY) &&
          <option value={NO_SERVICE_CATEGORY}>კატეგორიის გარეშე ({all.filter(r => keyOf(r) === NO_SERVICE_CATEGORY).length})</option>}
      </NativeSelect>
    </div>
    {groups.length === 0 ? <EmptyState icon={ReceiptText} message={q ? "ასეთი სერვისი ვერ მოიძებნა." : "სერვისების სია ცარიელია."} /> :
      <div className="space-y-5">{groups.map(g => {
        const categorySubs = subgroups.filter(s => s.systemSlug === g.key);
        const groupedItems = groupByServiceSubgroup(g.items);
        const sections: { key: string; name: string; subgroup?: SubgroupOption; items: CatalogueService[] }[] = categorySubs.filter(s => hit(g.name) || hit(s.name) || g.items.some(r => r.subgroupId === s.id))
          .map(s => ({ key: String(s.id), name: s.name, subgroup: s, items: groupedItems.find(group => group.key === String(s.id))?.items ?? [] }));
        const without = groupedItems.find(group => group.key === NO_SUBGROUP);
        if (without?.items.length || (!needle && sections.length === 0)) sections.push({
          key: NO_SUBGROUP, name: "ქვეჯგუფის გარეშე", subgroup: undefined, items: without?.items ?? [],
        });
        return <section key={g.key} aria-label={g.name}>
          <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-[12px] text-muted-foreground">
            <h2 className="min-w-0 basis-full break-words text-sm font-semibold sm:basis-0 sm:flex-1">{g.name} <span className="tabular text-[#8b98a9] dark:text-[var(--ln-faint)]">{g.items.length}</span></h2>
            {g.key !== NO_SERVICE_CATEGORY && <>
              <NewServiceDialog compact defaultSystemType={g.key} subgroups={subgroups} />
              {admin && <NewSubgroupMenu systemSlug={g.key} />}
            </>}
          </div>
          <div className="ln-card divide-y divide-[#eef1f6] dark:divide-border px-4">
            {sections.map(section => <div key={section.key} className="py-2">
              <div className="flex min-h-11 items-center gap-2">
                {section.subgroup ? <SubgroupRow row={section.subgroup} admin={admin}
                  used={catalogue.some(r => r.subgroupId === section.subgroup?.id)}
                  first={categorySubs[0]?.id === section.subgroup.id} last={categorySubs.at(-1)?.id === section.subgroup.id} />
                  : <h3 className="min-w-0 flex-1 text-[13px] font-semibold">{section.name}</h3>}
                {section.subgroup && <NewServiceDialog compact defaultSystemType={g.key} defaultSubgroupId={section.subgroup.id} subgroups={subgroups} />}
              </div>
              <div className="divide-y divide-[#eef1f6] dark:divide-border">
                {section.items.length === 0 && <p className="py-3 text-[12.5px] text-muted-foreground">სერვისი ჯერ არ არის.</p>}
                {section.items.map(s => <div key={s.id} className={`flex items-center gap-2 ${!s.active ? "opacity-60" : ""}`}>
                  <EditServiceDialog service={s} subgroups={subgroups} />
                  <ServiceActions id={s.id} name={s.name} active={s.active} canDelete={admin} />
                </div>)}
              </div>
            </div>)}
          </div>
        </section>;
      })}</div>}
  </div>;
}

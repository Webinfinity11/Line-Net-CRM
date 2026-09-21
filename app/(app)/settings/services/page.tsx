import { Layers, ReceiptText, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/section-card";
import { EditServiceDialog, NewServiceDialog } from "@/components/app/service-forms";
import { ServiceActions } from "@/components/app/service-toggle";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { listServices } from "@/lib/services";
import { requireUser } from "@/lib/session";
import { listSystems, systemLabels } from "@/lib/systems";

export const metadata = { title: "სერვისები და ფასები" };

export default async function ServicesPage({ searchParams }: PageProps<"/settings/services">) {
  const me = await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const [all, labels, systems] = await Promise.all([listServices({ q, includeInactive: true }), systemLabels(), listSystems()]);
  const keyOf = (r: (typeof all)[number]) => (r.systemType && labels[r.systemType] ? r.systemType : NONE);
  const rows = cat ? all.filter((r) => keyOf(r) === cat) : all;
  const active = rows.filter((r) => r.active).length;

  // A flat list of every service is a wall: group it under the categories, in the admin's order.
  const order = new Map(systems.map((s, i) => [s.key, i]));
  const rank = (key: string) => (key === NONE ? 1000 : (order.get(key) ?? 999));
  const byKey = new Map<string, typeof rows>();
  // a category without services yet is exactly where the first one gets added, so it keeps its group (not while searching)
  if (!q) for (const s of systems) if (s.active && (!cat || cat === s.key)) byKey.set(s.key, []);
  for (const r of rows) byKey.set(keyOf(r), [...(byKey.get(keyOf(r)) ?? []), r]);
  const groups = [...byKey.entries()]
    .map(([key, items]) => ({ key, name: key === NONE ? "კატეგორიის გარეშე" : labels[key], items }))
    .sort((a, b) => rank(a.key) - rank(b.key));
  const counts = new Map<string, number>();
  for (const s of systems) if (s.active) counts.set(s.key, 0);
  for (const r of all) counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1);
  const categories = [...counts.entries()]
    .map(([key, n]) => ({ key, n, name: key === NONE ? "კატეგორიის გარეშე" : labels[key] }))
    .sort((a, b) => rank(a.key) - rank(b.key));

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="პარამეტრები"
        title="სერვისები და ფასები"
        subtitle={`${rows.length} სერვისი · ${active} აქტიური. ეს სია ჩნდება შეკვეთაზე პოზიციის დამატებისას.`}
        actions={
          <>
            {me.role === "admin" && (
              <Button variant="outline" render={<Link href="/settings/services/categories" />}>
                <Layers className="size-4" /> კატეგორიები
              </Button>
            )}
            <NewServiceDialog defaultSystemType={systems.some((s) => s.key === cat) ? cat : undefined} />
          </>
        }
      />

      <form method="get" className="flex items-center gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="ძებნა"
          aria-label="ძებნა დასახელებით"
          className="h-11 min-w-0 flex-1 rounded-full border border-[#e6ebf2] bg-white px-4 text-[16px] outline-none focus:border-[#3457d5] sm:text-[13px]"
        />
        <NativeSelect name="cat" aria-label="კატეგორია" defaultValue={cat ?? ""}
          className="w-[138px] shrink-0 sm:w-[240px] [&_select]:h-11 [&_select]:rounded-full [&_select]:bg-white [&_select]:text-[16px] sm:[&_select]:text-[13px]">
          <NativeSelectOption value="">ყველა ({all.length})</NativeSelectOption>
          {categories.map((c) => <NativeSelectOption key={c.key} value={c.key}>{c.name} ({c.n})</NativeSelectOption>)}
          {cat && !categories.some((c) => c.key === cat) && <NativeSelectOption value={cat}>{labels[cat] ?? "კატეგორიის გარეშე"} (0)</NativeSelectOption>}
        </NativeSelect>
        <Button type="submit" variant="outline" size="icon" className="size-11 shrink-0" aria-label="ძებნა">
          <Search className="size-4" />
        </Button>
      </form>

      {groups.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          message={q ? "ასეთი სერვისი ვერ მოიძებნა." : "სერვისების სია ცარიელია. დაამატეთ პირველი: მაგ. „კამერის მონტაჟი“, ფასი ერთეულზე."}
          action={q ? undefined : <NewServiceDialog defaultSystemType={systems.some((s) => s.key === cat) ? cat : undefined} />}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.name}>
              <div className="mb-2 flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
                <h2 className="min-w-0 flex-1 break-words font-medium">{g.name} <span className="tabular text-[#8b98a9]">{g.items.length}</span></h2>
                {/* a new service must have a category, so the uncategorised group only gets fixed, not added to */}
                {g.key !== NONE && <NewServiceDialog compact defaultSystemType={g.key} />}
              </div>
              <div className="ln-card divide-y divide-[#eef1f6] px-4">
                {g.items.length === 0 && <p className="py-4 text-[12.5px] text-muted-foreground">ამ კატეგორიაში სერვისი ჯერ არ არის.</p>}
                {g.items.map((s) => (
                  <div key={s.id} className={`flex items-center gap-2 ${!s.active ? "opacity-60" : ""}`}>
                    <EditServiceDialog service={s} />
                    <ServiceActions id={s.id} name={s.name} active={s.active} canDelete={me.role === "admin"} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const NONE = "none";

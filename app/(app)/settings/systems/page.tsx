import { count, sql } from "drizzle-orm";
import { Layers } from "lucide-react";
import { db } from "@/db";
import { orders, services } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { NewSystemDialog, SystemRow } from "@/components/app/system-rows";
import { requireUser } from "@/lib/session";
import { listSystems } from "@/lib/systems";

export const metadata = { title: "სისტემები" };

export default async function SystemsPage() {
  await requireUser(["admin"]);
  const [rows, orderUse, serviceUse] = await Promise.all([
    listSystems(),
    db.select({ key: orders.systemType, n: count() }).from(orders).where(sql`${orders.systemType} is not null`).groupBy(orders.systemType),
    db.select({ key: services.systemType, n: count() }).from(services).where(sql`${services.systemType} is not null`).groupBy(services.systemType),
  ]);
  const usage = new Map<string, number>();
  for (const r of [...orderUse, ...serviceUse]) if (r.key) usage.set(r.key, (usage.get(r.key) ?? 0) + r.n);
  const active = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="პარამეტრები"
        title="სისტემები"
        subtitle="სამუშაო მიმართულებების სია. ჩნდება შეკვეთაზე, სერვისზე, ფილტრებსა და ანგარიშებში."
        actions={<NewSystemDialog />}
      />

      <SectionCard title="სამუშაო მიმართულებები" icon={Layers} aside={`${active} აქტიური · ${rows.length} სულ`}>
        <div className="hidden items-center gap-2 pb-2 text-[11px] text-muted-foreground sm:flex">
          <span className="w-5 shrink-0" />
          <span className="flex-1">დასახელება</span>
          <span className="w-[96px] shrink-0">გამოყენება</span>
          <span className="w-[214px] shrink-0" />
        </div>
        {rows.map((s, i) => (
          <SystemRow key={s.key} row={{ slug: s.key, name: s.name, sort: s.sort, active: s.active, usage: usage.get(s.key) ?? 0 }} first={i === 0} last={i === rows.length - 1} />
        ))}
        <p className="mt-4 border-t border-[#eef1f6] pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          თანმიმდევრობა ისრებით იცვლება და იმავე რიგით ჩანს ყველა სიაში. დამალული სისტემა ახალ ჩანაწერში აღარ შემოგთავაზებთ, ძველში კი
          რჩება. წაშლა მხოლოდ მაშინაა შესაძლებელი, როცა სისტემა არსად არ გამოიყენება.
        </p>
      </SectionCard>
    </div>
  );
}

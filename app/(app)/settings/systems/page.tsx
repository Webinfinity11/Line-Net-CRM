import { count, sql } from "drizzle-orm";
import { Layers } from "lucide-react";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { SystemRow } from "@/components/app/system-rows";
import { requireUser } from "@/lib/session";
import { listSystems } from "@/lib/systems";

export const metadata = { title: "სისტემები" };

export default async function SystemsPage() {
  await requireUser(["admin"]);
  const [rows, usageRows] = await Promise.all([
    listSystems(),
    db.select({ key: orders.systemType, n: count() }).from(orders).where(sql`${orders.systemType} is not null`).groupBy(orders.systemType),
  ]);
  const usage = new Map(usageRows.map((r) => [r.key, r.n]));

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="პარამეტრები"
        title="სისტემები"
        subtitle="ეს სია ჩნდება შეკვეთაზე, სერვისზე და ფილტრებში. სახელი და რიგითობა იცვლება, ზედმეტი იმალება."
      />
      <SectionCard title="სამუშაო მიმართულებები" icon={Layers} aside={`${rows.filter((r) => r.active).length} აქტიური`}>
        <div className="hidden gap-2 pb-2 text-[11px] text-muted-foreground sm:flex">
          <span className="flex-1">დასახელება</span>
          <span className="w-20">რიგი</span>
          <span className="w-[104px]">გამოყენება</span>
          <span className="w-[104px]" />
        </div>
        {rows.map((s) => (
          <SystemRow key={s.key} system={s} usage={usage.get(s.key) ?? 0} />
        ))}
        <p className="mt-4 border-t border-[#eef1f6] pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          დამალული სისტემა ახალ შეკვეთაზე აღარ შემოგთავაზებთ, მაგრამ ძველ შეკვეთებში ისევ ჩანს. სრულიად ახალი მიმართულების დამატება
          ბაზის ცვლილებას საჭიროებს: მოგვწერეთ და დავამატებთ.
        </p>
      </SectionCard>
    </div>
  );
}

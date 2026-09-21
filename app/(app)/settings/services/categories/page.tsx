import { count, sql } from "drizzle-orm";
import { ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { orders, services } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { NewSystemDialog, SystemRow } from "@/components/app/system-rows";
import { requireUser } from "@/lib/session";
import { listSystems } from "@/lib/systems";

export const metadata = { title: "კატეგორიები" };

export default async function SystemsPage() {
  await requireUser(["admin"]);
  const [rows, orderUse, serviceUse] = await Promise.all([
    listSystems(),
    db.select({ key: orders.systemType, n: count() }).from(orders).where(sql`${orders.systemType} is not null`).groupBy(orders.systemType),
    db.select({ key: services.systemType, n: count() }).from(services).where(sql`${services.systemType} is not null`).groupBy(services.systemType),
  ]);
  const orderCounts = new Map(orderUse.map((r) => [r.key, r.n]));
  const serviceCounts = new Map(serviceUse.map((r) => [r.key, r.n]));
  const active = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="სერვისები"
        title="კატეგორიები"
        subtitle="სერვისების დაჯგუფება. იგივე სია ჩნდება შეკვეთაზე, ფილტრებსა და ანგარიშებში."
        actions={
          <>
            <Button variant="outline" render={<Link href="/settings/services" />}>
              <ArrowLeft className="size-4" /> სერვისები
            </Button>
            <NewSystemDialog />
          </>
        }
      />

      <SectionCard title="კატეგორიების სია" icon={Layers} aside={`${active} აქტიური · ${rows.length} სულ`}>
        {rows.map((s, i) => (
          <SystemRow key={s.key} row={{ slug: s.key, name: s.name, sort: s.sort, active: s.active, services: serviceCounts.get(s.key) ?? 0, orders: orderCounts.get(s.key) ?? 0 }} first={i === 0} last={i === rows.length - 1} />
        ))}
        <p className="mt-4 border-t border-[#eef1f6] pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          სახელი აქვე შეცვალეთ. რიგის შეცვლა, გამორთვა და წაშლა — ⋯ მენიუში. გამორთული კატეგორია ძველ ჩანაწერებში რჩება.
        </p>
      </SectionCard>
    </div>
  );
}

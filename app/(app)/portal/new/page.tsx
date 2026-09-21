import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { PortalOrderForm } from "@/components/app/portal-order-form";
import { t } from "@/lib/i18n";
import { listPortalSites, requirePortalUser } from "@/lib/portal";

export const metadata = { title: "ახალი შეკვეთა" };

export default async function PortalNewOrderPage() {
  const { company } = await requirePortalUser();
  if (!company) redirect("/portal");
  const sites = await listPortalSites(company.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader kicker={company.name} title={t.order.new} subtitle="მოთხოვნა მიდის ლაინნეტის მენეჯერთან. სტატუსს „ჩემს შეკვეთებში“ ნახავთ." />
      <PortalOrderForm sites={sites} />
    </div>
  );
}

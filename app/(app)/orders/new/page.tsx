import { createOrderAndRedirect } from "@/actions/orders";
import { OrderForm } from "@/components/app/order-form";
import { PageHeader } from "@/components/app/page-header";
import { t } from "@/lib/i18n";
import { listAssignableUsers, listClientsWithSites } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata = { title: "ახალი შეკვეთა" };

export default async function NewOrderPage() {
  await requireUser(["admin", "manager"]);
  const [clients, users] = await Promise.all([listClientsWithSites(), listAssignableUsers()]);
  return (
    <div>
      <PageHeader title={t.order.new} subtitle="შეავსეთ შეკვეთის დეტალები და დანიშნეთ შემსრულებელი" />
      <OrderForm clients={clients} users={users} action={createOrderAndRedirect} submitLabel={t.common.create} cancelHref="/orders" />
    </div>
  );
}

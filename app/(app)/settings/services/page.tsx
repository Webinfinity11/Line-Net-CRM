import { ServicesCatalogue } from "@/components/app/services-catalogue";
import { listServices } from "@/lib/services";
import { requireUser } from "@/lib/session";
import { listSystems } from "@/lib/systems";
import { listSubgroups } from "@/lib/subgroups";

export const metadata = { title: "სერვისები და ფასები" };

export default async function ServicesPage() {
  const me = await requireUser(["admin", "manager"]);
  const [catalogue, systems, subgroups] = await Promise.all([
    listServices({ includeInactive: true }), listSystems(), listSubgroups(),
  ]);
  return <ServicesCatalogue catalogue={catalogue} systems={systems} subgroups={subgroups} admin={me.role === "admin"} />;
}

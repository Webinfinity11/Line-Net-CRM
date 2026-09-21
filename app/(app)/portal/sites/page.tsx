import { redirect } from "next/navigation";
import { MapPin, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PortalSiteDialog } from "@/components/app/portal-site-dialog";
import { listPortalSites, requirePortalUser } from "@/lib/portal";

export const metadata = { title: "მისამართები" };

export default async function PortalSitesPage() {
  const { company } = await requirePortalUser();
  if (!company) redirect("/portal");
  const sites = await listPortalSites(company.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={company.name} title="მისამართები" subtitle="თქვენი ობიექტები და ადგილზე საკონტაქტო პირები." actions={sites.length ? <PortalSiteDialog /> : undefined} />
      {sites.length ? (
        <div className="ln-card divide-y divide-border px-4 sm:px-6">
          {sites.map((site) => (
            <article key={site.id} aria-label={site.name} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-2 break-words">
                <p className="text-[15px] font-medium">{site.name}</p>
                <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{site.address || "მისამართი არ არის მითითებული"}</span></p>
                <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><UserRound className="mt-0.5 size-4 shrink-0" /><span className="min-w-0 break-words">{[site.contactName, site.contactPhone].filter(Boolean).join(" · ") || "საკონტაქტო პირი არ არის მითითებული"}</span></p>
              </div>
              <div className="shrink-0"><PortalSiteDialog site={site} /></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ln-card flex flex-col items-center gap-4 px-6 py-12 text-center">
          <MapPin className="size-7 text-muted-foreground" />
          <p className="text-[14px] text-muted-foreground">ჯერ მისამართები არ გაქვთ. დაამატეთ პირველი ობიექტი.</p>
          <PortalSiteDialog />
        </div>
      )}
    </div>
  );
}

import { setClientEmailsEnabled } from "@/actions/company";
import { ConfirmButton } from "@/components/app/confirm-button";
import { requireUser } from "@/lib/session";
import { getCompanySettings, clientEmailsEnabled } from "@/lib/settings";
import { toMtavruli } from "@/lib/mtavruli";
import { PageHeader } from "@/components/app/page-header";
import { CompanyForm } from "@/components/app/company-form";
export default async function CompanyPage() {
 await requireUser(["admin"]); const values = await getCompanySettings(); const enabled = await clientEmailsEnabled();
 return <div className="mx-auto max-w-[800px] space-y-4"><PageHeader title="კომპანიის რეკვიზიტები"/><div className="ln-card p-4"><CompanyForm values={values}/></div><section className="ln-card p-4 space-y-3"><h2 className="font-heading">{toMtavruli("კლიენტის მეილები")}</h2><p className="text-[13px]">{enabled ? "ჩართულია" : "გამორთულია"}</p><ConfirmButton variant="outline" title={enabled ? "მეილების გამორთვა" : "მეილების ჩართვა"} description="ჩართვამდე გამართეთ ფოსტის გაგზავნის უფლება და კომპანიის რეკვიზიტები." action={setClientEmailsEnabled.bind(null, !enabled)}>{enabled ? "გამორთვა" : "ჩართვა"}</ConfirmButton></section></div>;
}

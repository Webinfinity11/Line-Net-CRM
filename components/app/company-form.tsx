"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveCompany } from "@/actions/company";
import { COMPANY_FIELDS, type CompanySettings } from "@/lib/company";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function CompanyForm({ values }: { values: CompanySettings }) {
 const [pending, start] = useTransition();
 return <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await saveCompany(fd); r.ok ? toast.success("შენახულია") : toast.error(r.error); }); }}>{Object.entries(COMPANY_FIELDS).map(([key,label]) => <label className="text-[13px] space-y-1" key={key}>{label}<Input name={key} defaultValue={values[key as keyof CompanySettings]} type={key === "company_email" ? "email" : "text"} maxLength={500}/></label>)}<div className="sm:col-span-2"><Button type="submit" className="max-md:h-11" disabled={pending}>{pending ? "ინახება…" : "შენახვა"}</Button></div></form>;
}

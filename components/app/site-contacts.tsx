import { telHref } from "@/lib/order-utils";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteContacts, type SiteContact } from "@/db/schema";
import { saveSiteContact, deleteSiteContact } from "@/actions/site-contacts";
import { FormDialog } from "@/components/app/form-dialog";
import { ConfirmButton } from "@/components/app/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
function Fields({ contact }: { contact?: SiteContact }) {
 return <div className="space-y-3">{[["name", "სახელი"], ["position", "თანამდებობა"], ["phone", "ტელეფონი"], ["email", "ელფოსტა"]].map(([key,label]) => <label key={key} className="block text-[13px]">{label}<Input name={key} required={key === "name"} type={key === "email" ? "email" : "text"} defaultValue={String(contact?.[key as keyof SiteContact] ?? "")}/></label>)}<label className="text-[13px]"><input type="checkbox" name="receivesEmail" defaultChecked={contact?.receivesEmail}/> მეილს იღებს</label></div>;
}
export async function SiteContacts({ siteId, staff }: { siteId: number; staff: boolean }) {
 const contacts = await db.query.siteContacts.findMany({ where: eq(siteContacts.siteId, siteId) });
 return <section className="mt-3 min-w-0 space-y-2 border-t pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[12px]">საკონტაქტო პირები</span><FormDialog trigger={<Button variant="outline" size="xs" className="max-md:h-11"/>} triggerLabel="დამატება" title="საკონტაქტო პირი" action={saveSiteContact.bind(null, siteId, null)}><Fields/></FormDialog></div><ul className="divide-y">{contacts.map(c => <li key={c.id} className="py-2 text-[12px] break-words"><div className="flex items-center justify-between gap-2"><span>{c.name} {c.position && `· ${c.position}`}</span><details className="shrink-0"><summary aria-label="კონტაქტის მოქმედებები">⋯</summary><div className="flex flex-wrap gap-1"><FormDialog trigger={<Button size="xs" variant="ghost" className="max-md:h-11"/>} triggerLabel="რედაქტირება" title="კონტაქტის რედაქტირება" action={saveSiteContact.bind(null, siteId, c.id)}><Fields contact={c}/></FormDialog>{staff && <ConfirmButton title="კონტაქტის წაშლა" size="xs" variant="ghost" action={deleteSiteContact.bind(null, c.id)}>წაშლა</ConfirmButton>}</div></details></div><p className="break-all text-muted-foreground">{c.phone && <a href={telHref(c.phone) ?? undefined} className="ln-link whitespace-nowrap">{c.phone}</a>} {c.email && <a href={`mailto:${c.email}`} className="ln-link">{c.email}</a>}</p>{c.receivesEmail && <p className="text-muted-foreground">მეილს იღებს</p>}</li>)}</ul></section>;
}

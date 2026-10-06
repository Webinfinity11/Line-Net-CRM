import { desc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { boardVisibility } from "@/lib/competencies";
import { requireUser } from "@/lib/session";
import { TakeOrderButton } from "@/components/app/take-order-button";
import { PriorityLabel, StatusBadge, SystemBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { assigneeStage } from "@/lib/team-flow";
export const metadata = { title: "ყველა დავალება" };

export default async function Board() {
 const me = await requireUser(["executor", "manager", "admin"]);
 const rows = await db.query.orders.findMany({ where: await boardVisibility(me), columns: { id: true, number: true, title: true, status: true, priority: true, systemType: true, address: true }, with: { site: { columns: { name: true, address: true } }, assignees: { columns: { userId: true, doneAt: true }, with: { user: { columns: { name: true } } } }, visits: { columns: { userId: true } } }, orderBy: [desc(orders.createdAt)] });
 return <div className="mx-auto max-w-[900px] space-y-3"><PageHeader title="ყველა დავალება" /><Link href="/my" className="ln-link text-[13px]">ჩემი დავალებები</Link>{rows.length === 0 && <p className="ln-card px-6 py-14 text-center text-sm text-muted-foreground">აქტიური დავალება ახლა არ არის.</p>}{rows.map(o => { const assigned = o.assignees.some(a => a.userId === me.id); return <article key={o.id} className="ln-card p-4 space-y-2"><div className="flex flex-wrap gap-2 text-[12px]"><span>{o.number}</span><StatusBadge status={o.status}/><SystemBadge system={o.systemType}/><PriorityLabel priority={o.priority}/></div><h2 className="font-heading break-words text-[15px] font-bold">{assigned ? <Link href={`/orders/${o.id}`} className="ln-link">{o.title}</Link> : o.title}</h2><p className="text-[13px] break-words">{o.address ?? o.site?.address ?? o.site?.name}</p><ul className="text-[12px]">{o.assignees.map(a => <li key={a.userId}>{a.user.name} · {assigneeStage(a, o.visits)}</li>)}</ul>{!assigned && me.role === "executor" && ["new", "assigned", "in_progress"].includes(o.status) && <TakeOrderButton orderId={o.id}/>}</article>; })}</div>;
}

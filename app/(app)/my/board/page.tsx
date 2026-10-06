import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TakeOrderButton } from "@/components/app/take-order-button";
import { PriorityLabel, StatusBadge, SystemBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { assigneeStage } from "@/lib/team-flow";
export default async function Board() {
 const me = await requireUser(["executor", "manager", "admin"]);
 const rows = await db.query.orders.findMany({ where: and(eq(orders.triaged, true), inArray(orders.status, ["new", "assigned", "in_progress", "done"])), columns: { id: true, number: true, title: true, status: true, priority: true, systemType: true, address: true }, with: { site: { columns: { name: true, address: true } }, assignees: { columns: { userId: true, doneAt: true }, with: { user: { columns: { name: true } } } }, visits: { columns: { userId: true } } }, orderBy: [desc(orders.createdAt)] });
 return <div className="mx-auto max-w-[900px] space-y-3"><PageHeader title="ყველა შეკვეთა" /><Link href="/my" className="text-[13px] text-[#3457d5]">ჩემი შეკვეთები</Link>{rows.map(o => { const assigned = o.assignees.some(a => a.userId === me.id); return <article key={o.id} className="ln-card p-4 space-y-2"><div className="flex flex-wrap gap-2 text-[12px]"><span>{o.number}</span><StatusBadge status={o.status}/><SystemBadge system={o.systemType}/><PriorityLabel priority={o.priority}/></div><h2 className="font-heading break-words text-[15px] font-bold">{assigned ? <Link href={`/orders/${o.id}`}>{o.title}</Link> : o.title}</h2><p className="text-[13px] break-words">{o.address ?? o.site?.address ?? o.site?.name}</p><ul className="text-[12px]">{o.assignees.map(a => <li key={a.userId}>{a.user.name} · {assigneeStage(a, o.visits)}</li>)}</ul>{!assigned && me.role === "executor" && ["new", "assigned", "in_progress"].includes(o.status) && <TakeOrderButton orderId={o.id}/>}</article>; })}</div>;
}

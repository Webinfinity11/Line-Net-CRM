import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { previewClientMail } from "@/lib/client-mail";
import { CLIENT_MAIL_LABELS, type ClientMailKind } from "@/lib/client-mail-content";
import { PageHeader } from "@/components/app/page-header";
export default async function Preview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
 await requireUser(["admin", "manager"]);
 const { id } = await params; const { kind: asked } = await searchParams;
 const kind: ClientMailKind = asked === "scheduled" || asked === "completed" ? asked : "received";
 const orderId = Number(id); if (!Number.isInteger(orderId) || orderId <= 0) notFound();
 const mail = await previewClientMail(orderId, kind); if (!mail) notFound();
 return <div className="space-y-4"><PageHeader title="კლიენტის მეილის გადახედვა" subtitle="გადახედვა წერილს არ აგზავნის"/><Link href={`/orders/${id}`}>შეკვეთაზე დაბრუნება</Link><nav className="flex flex-wrap gap-3">{Object.entries(CLIENT_MAIL_LABELS).map(([k,label]) => <Link key={k} className="text-[#3457d5] text-[13px]" href={`?kind=${k}`}>{label}</Link>)}</nav><p className="text-[13px] break-all">მიმღები: {mail.to.join(", ") || "არ არის"}</p><div className="ln-card p-4 overflow-hidden break-words" dangerouslySetInnerHTML={{ __html: mail.html }}/><details><summary>ტექსტური ვერსია</summary><pre className="whitespace-pre-wrap break-words text-[12px]">{mail.text}</pre></details></div>;
}

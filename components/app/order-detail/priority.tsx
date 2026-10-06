"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPriority } from "@/actions/orders";
import { NativeSelect } from "@/components/ui/native-select";
import { PRIORITY_LABELS } from "@/lib/i18n";
export function QuickPriority({ id, value }: { id: number; value: string }) {
 const [pending, start] = useTransition(); const router = useRouter();
 return <label className="text-[12px]">პრიორიტეტი <NativeSelect className="text-[13px]" value={value} disabled={pending} onChange={e => { const v = e.target.value; start(async () => { const r = await setPriority(id, v); if (!r.ok) toast.error(r.error); router.refresh(); }); }}>{Object.entries(PRIORITY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></label>;
}

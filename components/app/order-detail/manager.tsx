import { takeOverOrder } from "@/actions/orders";
import { ConfirmButton } from "@/components/app/confirm-button";
import { formatDate } from "@/lib/i18n";
export function OrderManager({ id, manager, at, me }: { id: number; manager: { id: string; name: string } | null; at: Date | null; me: string }) {
 return <div className="flex flex-wrap items-center gap-2 text-[12px]"><span>{manager ? `პასუხისმგებელი: ${manager.name} · აიღო ${formatDate(at, true)}` : "პასუხისმგებელი არ ჰყავს"}</span>{manager?.id !== me && <ConfirmButton variant="outline" size="xs" title={manager ? "ჩემზე გადმოტანა" : "ავიღებ"} action={takeOverOrder.bind(null, id, !manager)}>{manager ? "ჩემზე გადმოტანა" : "ავიღებ"}</ConfirmButton>}</div>;
}

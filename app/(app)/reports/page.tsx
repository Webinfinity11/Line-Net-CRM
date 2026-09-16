import { Download } from "lucide-react";
import { SystemBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, t } from "@/lib/i18n";
import { defaultPeriod, reportByClient, reportByExecutor, reportBySystem, reportMonthly, type Period } from "@/lib/reports";
import { requireUser } from "@/lib/session";

export const metadata = { title: "ანგარიშები" };

const MONTHS = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];

function ExportLink({ type, p, label = "Excel" }: { type: string; p?: Period; label?: string }) {
  const qs = new URLSearchParams({ type, ...(p ? { from: p.from, to: p.to } : {}) });
  return (
    <a href={`/api/export?${qs}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800">
      <Download className="size-3" /> {label}
    </a>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const d = defaultPeriod();
  const p: Period = {
    from: typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : d.from,
    to: typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : d.to,
  };
  const [byClient, byExecutor, bySystem, monthly] = await Promise.all([reportByClient(p), reportByExecutor(p), reportBySystem(p), reportMonthly(12)]);
  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground";
  const thr = "px-3 py-2 text-right text-xs font-medium text-muted-foreground";
  const td = "px-3 py-2";
  const tdr = "px-3 py-2 text-right whitespace-nowrap";

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav2.reports}
        subtitle="პერიოდი შეკვეთის შექმნის თარიღით. „შემოსული“ რეალური გადახდებიდან ითვლება, „მასალების ხარჯი“ მხოლოდ ფასიანი პოზიციებიდან (სხვა ხარჯი არ იგულისხმება)."
        actions={
          <form method="get" className="flex items-center gap-2 text-sm">
            <input type="date" name="from" defaultValue={p.from} className="h-8 rounded-lg border bg-white px-2 dark:bg-neutral-900" />
            <span className="text-muted-foreground">—</span>
            <input type="date" name="to" defaultValue={p.to} className="h-8 rounded-lg border bg-white px-2 dark:bg-neutral-900" />
            <button type="submit" className="h-8 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
              ჩვენება
            </button>
            <ExportLink type="orders" p={p} label="შეკვეთები Excel" />
          </form>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">კლიენტების მიხედვით</CardTitle>
            <ExportLink type="clients" p={p} />
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>კლიენტი</th>
                  <th className={thr}>შეკვ.</th>
                  <th className={thr}>შესრ.</th>
                  <th className={thr}>თანხა</th>
                  <th className={thr}>გადაუხდელი</th>
                </tr>
              </thead>
              <tbody>
                {byClient.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      ამ პერიოდში მონაცემები არ არის
                    </td>
                  </tr>
                )}
                {byClient.map((r) => (
                  <tr key={r.clientId} className="border-b last:border-0">
                    <td className={td}>{r.client}</td>
                    <td className={tdr}>{r.total}</td>
                    <td className={tdr}>{r.completed}</td>
                    <td className={tdr}>{formatMoney(r.amount)}</td>
                    <td className={`${tdr} ${r.unpaid > 0 ? "text-rose-600" : ""}`}>{formatMoney(r.unpaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">შემსრულებლების მიხედვით</CardTitle>
            <ExportLink type="executors" p={p} />
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>შემსრულებელი</th>
                  <th className={thr}>შეკვ.</th>
                  <th className={thr}>შესრ.</th>
                  <th className={thr}>ვადაგად.</th>
                  <th className={thr}>საათები</th>
                </tr>
              </thead>
              <tbody>
                {byExecutor.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      ამ პერიოდში მონაცემები არ არის
                    </td>
                  </tr>
                )}
                {byExecutor.map((r) => (
                  <tr key={r.userId} className="border-b last:border-0">
                    <td className={td}>{r.name}</td>
                    <td className={tdr}>{r.total}</td>
                    <td className={tdr}>{r.completed}</td>
                    <td className={`${tdr} ${r.overdue > 0 ? "text-rose-600" : ""}`}>{r.overdue}</td>
                    <td className={tdr}>{r.hours || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">სისტემების მიხედვით</CardTitle>
            <ExportLink type="systems" p={p} />
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>სისტემა</th>
                  <th className={thr}>შეკვ.</th>
                  <th className={thr}>შესრ.</th>
                  <th className={thr}>თანხა</th>
                  <th className={thr}>გადახდილი</th>
                </tr>
              </thead>
              <tbody>
                {bySystem.map((r, i) => (
                  <tr key={r.system ?? `none-${i}`} className="border-b last:border-0">
                    <td className={td}>{r.system ? <SystemBadge system={r.system} /> : <span className="text-muted-foreground">მიუთითებელი</span>}</td>
                    <td className={tdr}>{r.total}</td>
                    <td className={tdr}>{r.completed}</td>
                    <td className={tdr}>{formatMoney(r.amount)}</td>
                    <td className={tdr}>{formatMoney(r.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">თვის ფინანსური (12 თვე)</CardTitle>
            <ExportLink type="monthly" />
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>თვე</th>
                  <th className={thr}>შეკვ.</th>
                  <th className={thr}>შესრ.</th>
                  <th className={thr}>შემოსული</th>
                  <th className={thr}>მასალების ხარჯი</th>
                  <th className={thr}>სხვაობა მასალების შემდეგ</th>
                </tr>
              </thead>
              <tbody>
                {monthly.months.map((m) => {
                  const [y, mo] = m.month.split("-");
                  return (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className={td}>
                        {MONTHS[Number(mo) - 1]} {y}
                      </td>
                      <td className={tdr}>{m.created}</td>
                      <td className={tdr}>{m.completed}</td>
                      <td className={tdr}>{formatMoney(m.revenue)}</td>
                      <td className={tdr}>{formatMoney(m.cost)}</td>
                      <td className={`${tdr} font-medium ${m.profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{formatMoney(m.profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-neutral-50 dark:bg-neutral-800/50">
                  <td colSpan={5} className="px-3 py-2 text-right text-xs text-muted-foreground">
                    დებიტორული დავალიანება (სულ)
                  </td>
                  <td className={`${tdr} font-semibold text-rose-600`}>{formatMoney(monthly.outstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

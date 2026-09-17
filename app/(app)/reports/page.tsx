import { Building2, Download, HardHat, Layers, TrendingUp } from "lucide-react";
import { SystemBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { DataList, DataRow, EmptyState, SectionCard, tableCls } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { formatMoney, t } from "@/lib/i18n";
import { defaultPeriod, reportByClient, reportByExecutor, reportBySystem, reportMonthly, type Period } from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "ანგარიშები" };

const MONTHS = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];

function ExportButton({ type, p, label = "Excel" }: { type: string; p?: Period; label?: string }) {
  const qs = new URLSearchParams({ type, ...(p ? { from: p.from, to: p.to } : {}) });
  return (
    <Button render={<a href={`/api/export?${qs}`} />} variant="outline" size="xs">
      <Download className="size-3" /> {label}
    </Button>
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

  const clientTotals = byClient.reduce((a, r) => ({ total: a.total + r.total, amount: a.amount + Number(r.amount ?? 0), unpaid: a.unpaid + Number(r.unpaid ?? 0) }), { total: 0, amount: 0, unpaid: 0 });
  const systemTotals = bySystem.reduce((a, r) => ({ total: a.total + r.total, amount: a.amount + Number(r.amount ?? 0), paid: a.paid + Number(r.paid ?? 0) }), { total: 0, amount: 0, paid: 0 });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t.nav2.reports}
        subtitle="პერიოდი შეკვეთის შექმნის თარიღით. „შემოსული“ რეალური გადახდებიდან ითვლება."
        actions={<ExportButton type="orders" p={p} label="შეკვეთები Excel" />}
      />

      <form method="get" className="ln-enter ln-card grid gap-3 p-4 sm:flex sm:flex-wrap sm:items-end">
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="space-y-1.5">
            <label htmlFor="from" className="block text-[11px] text-muted-foreground">
              დაწყება
            </label>
            <input id="from" type="date" name="from" defaultValue={p.from} className="h-11 w-full rounded-lg border border-[#e6ebf2] bg-white px-3 text-[16px] outline-none focus:border-[#7f97e6] sm:h-9 sm:w-auto sm:text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="block text-[11px] text-muted-foreground">
              დასრულება
            </label>
            <input id="to" type="date" name="to" defaultValue={p.to} className="h-11 w-full rounded-lg border border-[#e6ebf2] bg-white px-3 text-[16px] outline-none focus:border-[#7f97e6] sm:h-9 sm:w-auto sm:text-[13px]" />
          </div>
        </div>
        <Button type="submit" size="sm" className="h-11 w-full sm:h-8 sm:w-auto">
          ჩვენება
        </Button>
        <p className="text-[11px] text-muted-foreground sm:ml-auto">
          {byClient.length} კლიენტი · {byExecutor.length} შემსრულებელი
        </p>
      </form>

      <div className="ln-enter ln-enter-2 grid gap-4 xl:grid-cols-2">
        <SectionCard title="კლიენტების მიხედვით" icon={Building2} action={<ExportButton type="clients" p={p} />} bodyClassName="-mx-6 -mb-6">
          {byClient.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState icon={Building2} message="ამ პერიოდში მონაცემები არ არის." />
            </div>
          ) : (
            <>
            <DataList className="px-6 pb-4">
              {byClient.map((r) => (
                <DataRow
                  key={r.clientId}
                  title={r.client}
                  meta={`${r.total} შეკვეთა · ${r.completed} შესრულებული`}
                  right={
                    <>
                      <div className="tabular font-medium">{formatMoney(r.amount)}</div>
                      {r.unpaid > 0 && <div className="tabular text-[11.5px] text-[#b13f32]">{formatMoney(r.unpaid)}</div>}
                    </>
                  }
                />
              ))}
            </DataList>
            <div className={cn(tableCls.scroll, "hidden sm:block")}>
              <table className={tableCls.table}>
                <thead className={tableCls.head}>
                  <tr>
                    <th className={tableCls.th}>კლიენტი</th>
                    <th className={tableCls.thRight}>შეკვ.</th>
                    <th className={tableCls.thRight}>შესრ.</th>
                    <th className={tableCls.thRight}>თანხა</th>
                    <th className={tableCls.thRight}>გადაუხდელი</th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.map((r) => (
                    <tr key={r.clientId} className={tableCls.row}>
                      <td className={cn(tableCls.td, "font-medium")}>{r.client}</td>
                      <td className={tableCls.tdRight}>{r.total}</td>
                      <td className={tableCls.tdRight}>{r.completed}</td>
                      <td className={tableCls.tdRight}>{formatMoney(r.amount)}</td>
                      <td className={cn(tableCls.tdRight, r.unpaid > 0 && "font-medium text-[#b13f32]")}>{formatMoney(r.unpaid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#eef1f6] bg-[#fbfcfe]">
                    <td className={cn(tableCls.td, "text-[11px] text-muted-foreground")}>სულ</td>
                    <td className={cn(tableCls.tdRight, "font-semibold")}>{clientTotals.total}</td>
                    <td className={tableCls.tdRight} />
                    <td className={cn(tableCls.tdRight, "font-semibold")}>{formatMoney(clientTotals.amount)}</td>
                    <td className={cn(tableCls.tdRight, "font-semibold text-[#b13f32]")}>{formatMoney(clientTotals.unpaid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="შემსრულებლების მიხედვით" icon={HardHat} action={<ExportButton type="executors" p={p} />} bodyClassName="-mx-6 -mb-6">
          {byExecutor.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState icon={HardHat} message="ამ პერიოდში მონაცემები არ არის." />
            </div>
          ) : (
            <>
            <DataList className="px-6 pb-4">
              {byExecutor.map((r) => (
                <DataRow
                  key={r.userId}
                  title={r.name}
                  meta={`${r.total} შეკვეთა · ${r.completed} შესრულებული`}
                  right={r.overdue > 0 ? <span className="font-medium text-[#b13f32]">{r.overdue} ვადაგად.</span> : <span className="text-muted-foreground">—</span>}
                />
              ))}
            </DataList>
            <div className={cn(tableCls.scroll, "hidden sm:block")}>
              <table className={tableCls.table}>
                <thead className={tableCls.head}>
                  <tr>
                    <th className={tableCls.th}>შემსრულებელი</th>
                    <th className={tableCls.thRight}>შეკვ.</th>
                    <th className={tableCls.thRight}>შესრ.</th>
                    <th className={tableCls.thRight}>ვადაგად.</th>
                  </tr>
                </thead>
                <tbody>
                  {byExecutor.map((r) => (
                    <tr key={r.userId} className={tableCls.row}>
                      <td className={cn(tableCls.td, "font-medium")}>{r.name}</td>
                      <td className={tableCls.tdRight}>{r.total}</td>
                      <td className={tableCls.tdRight}>{r.completed}</td>
                      <td className={cn(tableCls.tdRight, r.overdue > 0 && "font-medium text-[#b13f32]")}>{r.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="სისტემების მიხედვით" icon={Layers} action={<ExportButton type="systems" p={p} />} bodyClassName="-mx-6 -mb-6">
          {bySystem.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState icon={Layers} message="ამ პერიოდში მონაცემები არ არის." />
            </div>
          ) : (
            <>
            <DataList className="px-6 pb-4">
              {bySystem.map((r, i) => (
                <DataRow
                  key={r.system ?? `none-${i}`}
                  title={r.system ? <SystemBadge system={r.system} /> : <span className="text-muted-foreground">მიუთითებელი</span>}
                  meta={`${r.total} შეკვეთა · ${r.completed} შესრულებული`}
                  right={
                    <>
                      <div className="tabular font-medium">{formatMoney(r.amount)}</div>
                      <div className="tabular text-[11.5px] text-[#25815a]">{formatMoney(r.paid)}</div>
                    </>
                  }
                />
              ))}
            </DataList>
            <div className={cn(tableCls.scroll, "hidden sm:block")}>
              <table className={tableCls.table}>
                <thead className={tableCls.head}>
                  <tr>
                    <th className={tableCls.th}>სისტემა</th>
                    <th className={tableCls.thRight}>შეკვ.</th>
                    <th className={tableCls.thRight}>შესრ.</th>
                    <th className={tableCls.thRight}>თანხა</th>
                    <th className={tableCls.thRight}>გადახდილი</th>
                  </tr>
                </thead>
                <tbody>
                  {bySystem.map((r, i) => (
                    <tr key={r.system ?? `none-${i}`} className={tableCls.row}>
                      <td className={tableCls.td}>{r.system ? <SystemBadge system={r.system} /> : <span className="text-muted-foreground">მიუთითებელი</span>}</td>
                      <td className={tableCls.tdRight}>{r.total}</td>
                      <td className={tableCls.tdRight}>{r.completed}</td>
                      <td className={tableCls.tdRight}>{formatMoney(r.amount)}</td>
                      <td className={cn(tableCls.tdRight, "text-[#25815a]")}>{formatMoney(r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#eef1f6] bg-[#fbfcfe]">
                    <td className={cn(tableCls.td, "text-[11px] text-muted-foreground")}>სულ</td>
                    <td className={cn(tableCls.tdRight, "font-semibold")}>{systemTotals.total}</td>
                    <td className={tableCls.tdRight} />
                    <td className={cn(tableCls.tdRight, "font-semibold")}>{formatMoney(systemTotals.amount)}</td>
                    <td className={cn(tableCls.tdRight, "font-semibold text-[#25815a]")}>{formatMoney(systemTotals.paid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="თვის ფინანსური" icon={TrendingUp} aside="12 თვე" action={<ExportButton type="monthly" />} bodyClassName="-mx-6 -mb-6">
          <DataList className="px-6 pb-4">
            {monthly.months.map((m) => {
              const [y, mo] = m.month.split("-");
              return (
                <DataRow
                  key={m.month}
                  title={`${MONTHS[Number(mo) - 1]} ${y}`}
                  meta={`${m.created} შეკვეთა · ${m.completed} შესრულებული`}
                  right={
                    <>
                      <div className="tabular text-[#25815a]">{formatMoney(m.revenue)}</div>
                      <div className={cn("tabular text-[11.5px]", m.profit < 0 ? "text-[#b13f32]" : "text-muted-foreground")}>{formatMoney(m.profit)}</div>
                    </>
                  }
                />
              );
            })}
          </DataList>
          <div className={cn(tableCls.scroll, "hidden sm:block")}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>თვე</th>
                  <th className={tableCls.thRight}>შეკვ.</th>
                  <th className={tableCls.thRight}>შესრ.</th>
                  <th className={tableCls.thRight}>შემოსული</th>
                  <th className={tableCls.thRight}>მასალები</th>
                  <th className={tableCls.thRight}>სხვაობა</th>
                </tr>
              </thead>
              <tbody>
                {monthly.months.map((m) => {
                  const [y, mo] = m.month.split("-");
                  return (
                    <tr key={m.month} className={tableCls.row}>
                      <td className={cn(tableCls.td, "whitespace-nowrap font-medium")}>
                        {MONTHS[Number(mo) - 1]} {y}
                      </td>
                      <td className={tableCls.tdRight}>{m.created}</td>
                      <td className={tableCls.tdRight}>{m.completed}</td>
                      <td className={cn(tableCls.tdRight, "text-[#25815a]")}>{formatMoney(m.revenue)}</td>
                      <td className={tableCls.tdRight}>{formatMoney(m.cost)}</td>
                      <td className={cn(tableCls.tdRight, "font-medium", m.profit < 0 ? "text-[#b13f32]" : "text-[#25815a]")}>{formatMoney(m.profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#eef1f6] bg-[#fbfcfe]">
                  <td colSpan={5} className={cn(tableCls.td, "text-right text-[11px] text-muted-foreground")}>
                    დებიტორული დავალიანება (სულ)
                  </td>
                  <td className={cn(tableCls.tdRight, "font-semibold text-[#b13f32]")}>{formatMoney(monthly.outstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

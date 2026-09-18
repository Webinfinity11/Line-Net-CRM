"use client";

import { FileCheck2, HardHat, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { CountUp, DrawnArea, GrowBar, Reveal } from "@/components/app/motion";
import { UserAvatar } from "@/components/app/user-avatar";
import type { Aging, Conversion, CrewRow, RevenueTrend } from "@/lib/analytics";
import { formatMoney } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
const monthLabel = (m: string) => MONTHS_SHORT[Number(m.slice(5, 7)) - 1] ?? m;

function CardHead({ icon: Icon, title, aside }: { icon: typeof TrendingUp; title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-heading text-[15px]">
        <Icon className="size-4 text-muted-foreground [stroke-width:1.7]" /> {toMtavruli(title)}
      </h2>
      {aside ? <span className="text-[11.5px] text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/** Money actually received, month by month, for a year. */
export function RevenueTrendCard({ trend }: { trend: RevenueTrend }) {
  const points = trend.months.map((m) => m.revenue);
  const last = trend.months.length - 1;
  const labels = trend.months.map((m, i) => (i === 0 || i === last || i % 3 === 0 ? monthLabel(m.month) : ""));
  const total = points.reduce((s, v) => s + v, 0);

  return (
    <Reveal as="section" className="ln-card ln-lift min-w-0 p-6" delay={0} ariaLabel="შემოსავლის ტრენდი" view="trend">
      <CardHead icon={TrendingUp} title="შემოსავლის ტრენდი" aside="12 თვე" />
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-[11px] text-muted-foreground">წლის ჯამი</div>
          <CountUp value={total} format={formatMoney} className="font-heading text-[26px] font-semibold leading-none tracking-[-0.6px]" />
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">საუკეთესო თვე</div>
          <div className="tabular font-heading text-[16px] font-semibold text-[#25815a]">{formatMoney(trend.best)}</div>
        </div>
      </div>
      <DrawnArea className="mt-4" points={points} height={130} stroke="#3457d5" fill="#3457d5" labels={labels} />
    </Reveal>
  );
}

/** How old the unpaid money is. The eye should land on the right-hand buckets. */
export function AgingCard({ aging }: { aging: Aging }) {
  const tones = ["#7f97e6", "#e0b563", "#d98a5a", "#b13f32"];
  const total = Math.max(1, aging.total);

  return (
    <Reveal as="section" className="ln-card ln-lift min-w-0 p-6" delay={80} ariaLabel="გადაუხდელები" view="aging">
      <CardHead icon={Wallet} title="გადაუხდელები" aside="ყველა შეკვეთა" />
      <CountUp value={aging.total} format={formatMoney} className="font-heading text-[26px] font-semibold leading-none tracking-[-0.6px]" />
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {aging.overdue > 0 ? (
          <>
            აქედან 30 დღეზე ძველი <span className="font-medium text-[#b13f32]">{formatMoney(aging.overdue)}</span>
          </>
        ) : (
          "ყველა დავალიანება 30 დღეზე ახალია"
        )}
      </p>

      {/* one stacked bar, then the buckets underneath */}
      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {aging.buckets.map((b, i) => (
          <div key={b.key} className="h-full" style={{ width: `${(b.amount / total) * 100}%` }}>
            <GrowBar pct={100} color={tones[i]} delay={i * 110} className="h-full rounded-none first:rounded-l-full last:rounded-r-full" />
          </div>
        ))}
      </div>

      <dl className="mt-4 space-y-2">
        {aging.buckets.map((b, i) => (
          <div key={b.key} className="flex items-center gap-2 text-[12.5px]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: tones[i] }} />
            <dt className="min-w-0 flex-1 truncate text-muted-foreground">
              {b.days}
              {b.count > 0 && <span className="ml-1.5 text-[11px]">· {b.count}</span>}
            </dt>
            <dd className={cn("tabular font-medium", i === 3 && b.amount > 0 && "text-[#b13f32]")}>{formatMoney(b.amount)}</dd>
          </div>
        ))}
      </dl>

      {aging.oldest && (
        <Link
          href={`/orders/${aging.oldest.id}`}
          className="mt-4 flex items-center justify-between gap-2 rounded-[12px] bg-[#f8faff] px-3 py-2.5 text-[12px] transition-colors hover:bg-[#eef2ff]"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{aging.oldest.client ?? aging.oldest.title}</span>
            <span className="text-[11px] text-muted-foreground">
              {aging.oldest.number} · {aging.oldest.days} დღე
            </span>
          </span>
          <span className="tabular shrink-0 font-semibold text-[#b13f32]">{formatMoney(aging.oldest.amount)}</span>
        </Link>
      )}
    </Reveal>
  );
}

/** Who carried the month: hours booked, jobs handed over, money earned. */
export function CrewCard({ crew, normHours }: { crew: CrewRow[]; normHours: number }) {
  const top = crew.slice(0, 5);
  return (
    <Reveal as="section" className="ln-card ln-lift min-w-0 p-6" delay={160} ariaLabel="ტექნიკოსების შედეგი" view="crew">
      <CardHead icon={HardHat} title="ტექნიკოსები" aside="ამ თვეში" />
      {top.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[#e6ebf2] px-4 py-6 text-center text-[12.5px] text-muted-foreground">ამ თვეში დანიშნული სამუშაო ჯერ არ არის.</p>
      ) : (
        <ul className="space-y-4">
          {top.map((c, i) => (
            <li key={c.id}>
              <div className="mb-1.5 flex items-center gap-2.5">
                <UserAvatar name={c.name} image={c.image} size="md" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.name}</span>
                <CountUp value={c.revenue} format={formatMoney} className="shrink-0 text-[13px] font-semibold text-[#25815a]" duration={900} />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 min-w-0 flex-1">
                  <GrowBar pct={c.utilPct} color={c.utilPct > 90 ? "#b13f32" : c.utilPct > 60 ? "#3457d5" : "#8fa6dd"} delay={200 + i * 90} />
                </div>
                <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                  {c.hours} სთ · {c.completed} შესრ.
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-[#eef1f6] pt-3 text-[11px] text-muted-foreground">დატვირთვა ითვლება დღის ნორმაზე ({normHours} სთ) და თვის გასულ დღეებზე.</p>
    </Reveal>
  );
}

/** Quotes sent against quotes won, and the money still on the table. */
export function ConversionCard({ c }: { c: Conversion }) {
  const rate = c.rate ?? 0;
  const circumference = 2 * Math.PI * 42;

  return (
    <Reveal as="section" className="ln-card ln-lift min-w-0 p-6" delay={240} ariaLabel="შეთავაზებების კონვერსია" view="quotes">
      <CardHead icon={FileCheck2} title="შეთავაზებები" aside="3 თვე" />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <div className="relative size-[96px] shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#eef1f6" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#25815a"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - rate / 100)}
              className="transition-[stroke-dashoffset] duration-[1200ms] ease-[cubic-bezier(0.16,0.84,0.44,1)] motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            {c.rate === null ? (
              <span className="text-[12px] text-muted-foreground">—</span>
            ) : (
              <CountUp value={rate} format={(n) => `${Math.round(n)}%`} className="font-heading text-[22px] font-bold tracking-[-0.5px]" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">მოგებული სამუშაო</div>
          <CountUp value={c.acceptedValue} format={formatMoney} className="font-heading text-[20px] font-semibold leading-tight text-[#25815a]" duration={900} />
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{c.accepted} შეთავაზებიდან</div>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-[#eef1f6] pt-3 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">პასუხის მოლოდინში</dt>
          <dd className="tabular font-medium">
            {c.sent} · {formatMoney(c.openValue)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">უარყოფილი</dt>
          <dd className="tabular font-medium text-muted-foreground">{c.declined}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">საშუალო ღირებულება</dt>
          <dd className="tabular font-semibold">{formatMoney(c.avgValue)}</dd>
        </div>
      </dl>
      <Link href="/quotes" className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-[#3457d5] hover:underline">
        ყველა შეთავაზება
      </Link>
    </Reveal>
  );
}

import { ArrowUpRight, Building2, CalendarDays, Printer, Trash2, User } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteQuote } from "@/actions/quotes";
import { SystemBadge } from "@/components/app/badges";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PageHeader } from "@/components/app/page-header";
import { QuoteActions } from "@/components/app/quotes/quote-actions";
import { EditQuoteDialog } from "@/components/app/quotes/quote-form-dialog";
import { QuoteLines } from "@/components/app/quotes/quote-lines";
import { QuoteNotes } from "@/components/app/quotes/quote-notes";
import { QuoteStatusBadge, quoteTotals } from "@/components/app/quotes/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/i18n";
import { listClientsWithSites } from "@/lib/orders";
import { getQuote } from "@/lib/quotes";
import { tbilisiToday } from "@/lib/schedule-utils";
import { listActiveServices } from "@/lib/services";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  return { title: `შეთავაზება ${id}` };
}

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const me = await requireUser(["admin", "manager"]);
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) notFound();
  const quote = await getQuote(quoteId);
  if (!quote) notFound();

  const [catalogue, clientRows] = await Promise.all([listActiveServices(), listClientsWithSites()]);
  const clients = clientRows.map((c) => ({ id: c.id, name: c.name, sites: c.sites.map((s) => ({ id: s.id, name: s.name })) }));
  const decided = quote.status === "accepted" || quote.status === "declined";
  const { total, vatRate } = quoteTotals(quote.items, quote.vatPercent);
  const expired = quote.validUntil && quote.validUntil < tbilisiToday() && !decided;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker={quote.number ?? "შეთავაზება"}
        title={quote.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            <span>{quote.client?.name ?? "კლიენტის გარეშე"}</span>
            {quote.site ? <span>· {quote.site.name}</span> : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <QuoteActions id={quote.id} status={quote.status} hasOrder={Boolean(quote.orderId)} />
            <Button variant="outline" size="sm" render={<Link href={`/quotes/${quote.id}/pdf`} target="_blank" />}>
              <Printer className="size-3.5" /> PDF
            </Button>
            {!decided && (
              <EditQuoteDialog
                id={quote.id}
                clients={clients}
                initial={{
                  title: quote.title,
                  clientId: quote.clientId,
                  siteId: quote.siteId,
                  systemType: quote.systemType,
                  note: quote.note,
                  terms: quote.terms,
                  validUntil: quote.validUntil,
                  vatPercent: quote.vatPercent,
                }}
              />
            )}
            {me.role === "admin" && (
              <ConfirmButton
                title="შეთავაზების წაშლა"
                description="შეთავაზება და მისი პოზიციები სამუდამოდ წაიშლება. შექმნილი შეკვეთა რჩება."
                confirmLabel="წაშლა"
                variant="destructive"
                size="sm"
                action={deleteQuote.bind(null, quote.id)}
                redirectTo="/quotes"
              >
                <Trash2 className="size-3.5" /> წაშლა
              </ConfirmButton>
            )}
          </div>
        }
      />

      <div className="ln-enter grid gap-4 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="min-w-0 space-y-4">
          <QuoteLines quoteId={quote.id} items={quote.items} catalogue={catalogue} vatPercent={quote.vatPercent} readOnly={decided} />
          <QuoteNotes
            quote={{
              id: quote.id,
              title: quote.title,
              clientId: quote.clientId,
              siteId: quote.siteId,
              systemType: quote.systemType,
              validUntil: quote.validUntil,
              vatPercent: quote.vatPercent,
              note: quote.note,
              terms: quote.terms,
            }}
            readOnly={decided}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle>დეტალები</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-[12.5px]">
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-[11px] text-muted-foreground">კლიენტი / ობიექტი</dt>
                    <dd className="font-medium">
                      {quote.client ? (
                        <Link href={`/clients/${quote.client.id}`} className="hover:text-primary">
                          {quote.client.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {quote.site ? <span className="text-muted-foreground"> · {quote.site.name}</span> : null}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground">ძალაშია თარიღამდე</dt>
                    <dd className={cn("font-medium", expired && "text-[#b13f32] dark:text-[var(--ln-alert)]")}>{quote.validUntil ? formatDate(quote.validUntil) : "ვადის გარეშე"}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground">შექმნა</dt>
                    <dd className="font-medium">
                      {quote.creator?.name ?? "—"} · {formatDate(quote.createdAt)}
                    </dd>
                  </div>
                </div>
                {quote.systemType ? (
                  <div>
                    <dt className="mb-1 text-[11px] text-muted-foreground">კატეგორია</dt>
                    <dd>
                      <SystemBadge system={quote.systemType} />
                    </dd>
                  </div>
                ) : null}
                <div className="border-t border-[#eef1f6] dark:border-border pt-3">
                  <dt className="text-[11px] text-muted-foreground">სულ გადასახდელი{vatRate > 0 ? ` (დღგ ${vatRate}%)` : ""}</dt>
                  <dd className="tabular mt-1 font-heading text-[24px] font-semibold text-[#25815a] dark:text-[var(--ln-success)]">{formatMoney(total)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {quote.order ? (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle>შეკვეთა</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/orders/${quote.order.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
                  {quote.order.number} <ArrowUpRight className="size-3.5" />
                </Link>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">შეთავაზების პოზიციები შეკვეთაზეა გადატანილი.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

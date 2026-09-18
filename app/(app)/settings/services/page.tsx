import { ReceiptText, Search, Trash2 } from "lucide-react";
import { deleteService } from "@/actions/services";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PageHeader } from "@/components/app/page-header";
import { Chip, DataList, DataRow, EmptyState, tableCls } from "@/components/app/section-card";
import { EditServiceDialog, NewServiceDialog } from "@/components/app/service-forms";
import { ToggleActive } from "@/components/app/service-toggle";
import { Button } from "@/components/ui/button";
import { SYSTEM_LABELS, formatMoney } from "@/lib/i18n";
import { listServices } from "@/lib/services";
import { requireUser } from "@/lib/session";

export const metadata = { title: "სერვისები და ფასები" };

export default async function ServicesPage({ searchParams }: PageProps<"/settings/services">) {
  const me = await requireUser(["admin", "manager"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const rows = await listServices({ q, includeInactive: true });
  const active = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="პარამეტრები"
        title="სერვისები და ფასები"
        subtitle={`${rows.length} სერვისი · ${active} აქტიური. ეს სია ჩნდება შეკვეთაზე პოზიციის დამატებისას.`}
        actions={<NewServiceDialog />}
      />

      <form method="get" className="ln-card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ძებნა დასახელებით"
            className="h-11 w-full rounded-full border border-[#e6ebf2] bg-[#f8faff] pl-9 pr-3 text-[16px] outline-none transition focus:border-[#a5b5ed] focus:bg-white sm:h-9 sm:text-[13px]"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-11 sm:h-9">
          ძებნა
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          message={q ? "ამ ძებნაზე სერვისი ვერ მოიძებნა." : "სერვისების სია ცარიელია. დაამატეთ პირველი: მაგ. „კამერის მონტაჟი“, ფასი ერთეულზე."}
          action={q ? undefined : <NewServiceDialog />}
        />
      ) : (
        <div className={tableCls.wrap}>
          <DataList className="px-4 py-2">
            {rows.map((s) => (
              <DataRow
                key={s.id}
                title={s.name}
                meta={
                  <>
                    <div>
                      {s.systemType ? SYSTEM_LABELS[s.systemType] : "ყველა სისტემა"} · {s.unit}
                    </div>
                    {s.description ? <div className="line-clamp-2">{s.description}</div> : null}
                    {!s.active && <Chip tone="warn">გამორთულია</Chip>}
                  </>
                }
                right={<span className="tabular font-heading text-[15px]">{formatMoney(s.price)}</span>}
                actions={
                  // icons only: 27 rows of three labelled buttons turn the phone list into a wall
                  <>
                    <EditServiceDialog service={s} compact />
                    <ToggleActive id={s.id} active={s.active} compact />
                    {me.role === "admin" && (
                      <ConfirmButton
                        title="სერვისის წაშლა"
                        description="უკვე გაცემულ შეკვეთებში ჩაწერილი პოზიციები დარჩება: მათ საკუთარი ფასი აქვთ."
                        confirmLabel="წაშლა"
                        variant="ghost"
                        size="sm"
                        ariaLabel={`${s.name} წაშლა`}
                        className="size-10 p-0"
                        action={deleteService.bind(null, s.id)}
                      >
                        <Trash2 className="size-4 text-[#b13f32]" />
                      </ConfirmButton>
                    )}
                  </>
                }
              />
            ))}
          </DataList>

          <div className={`hidden sm:block ${tableCls.scroll}`}>
            <table className={tableCls.table}>
              <thead className={tableCls.head}>
                <tr>
                  <th className={tableCls.th}>დასახელება</th>
                  <th className={tableCls.th}>სისტემა</th>
                  <th className={tableCls.th}>ერთეული</th>
                  <th className={tableCls.thRight}>ფასი</th>
                  <th className={tableCls.th}>სტატუსი</th>
                  <th className={tableCls.thRight}>მოქმედებები</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={tableCls.row}>
                    <td className={tableCls.td}>
                      <div className="font-medium">{s.name}</div>
                      {s.description ? <div className="truncate text-[11.5px] text-muted-foreground">{s.description}</div> : null}
                    </td>
                    <td className={tableCls.td}>{s.systemType ? <Chip>{SYSTEM_LABELS[s.systemType]}</Chip> : <span className="text-muted-foreground">ყველა</span>}</td>
                    <td className={tableCls.td}>{s.unit}</td>
                    <td className={`${tableCls.tdRight} font-semibold`}>{formatMoney(s.price)}</td>
                    <td className={tableCls.td}>
                      {s.active ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#25815a]">
                          <i className="size-[6px] rounded-full bg-[#25815a]" /> აქტიური
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <i className="size-[6px] rounded-full bg-[#c2ccd8]" /> გამორთული
                        </span>
                      )}
                    </td>
                    <td className={tableCls.tdRight}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <EditServiceDialog service={s} />
                        <ToggleActive id={s.id} active={s.active} />
                        {me.role === "admin" && (
                          <ConfirmButton
                            title="სერვისის წაშლა"
                            description="უკვე გაცემულ შეკვეთებში ჩაწერილი პოზიციები დარჩება: მათ საკუთარი ფასი აქვთ."
                            confirmLabel="წაშლა"
                            variant="destructive"
                            size="sm"
                            action={deleteService.bind(null, s.id)}
                          >
                            წაშლა
                          </ConfirmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Mail, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { connectOutlook, disconnectOutlook, pollMailNow } from "@/actions/mail";
import { ConfirmButton } from "@/components/app/confirm-button";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n";
import type { MailSyncState } from "@/lib/graph-mail";
import { toMtavruli } from "@/lib/mtavruli";

export function MailSyncStatus({ state, canManage }: { state: MailSyncState; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const connectButton = (
    <Button size="sm" className="h-11 w-full sm:h-8 sm:w-auto max-md:w-full max-md:flex-none max-md:whitespace-nowrap" disabled={pending || !state.canConnect} onClick={() => start(() => connectOutlook())}>
      <Mail className="size-4 shrink-0" /> {state.configured ? "ხელახლა დაკავშირება" : "Outlook ფოსტის დაკავშირება"}
    </Button>
  );

  if (!state.configured) {
    return (
      <div className="ln-card ln-enter p-5 max-md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <h2 className="flex items-center gap-2 font-heading text-[15px]"><Mail className="size-4 text-[#3457d5] [stroke-width:1.7]" /> {toMtavruli('Outlook ფოსტა')}</h2>
            <p className="text-[12.5px] text-muted-foreground">შეგიძლიათ გამოიყენოთ უფასო Outlook.com ან Hotmail ფოსტა — Microsoft 365-ის ფასიანი გამოწერა საჭირო არ არის.</p>
            <p className="text-[11.5px] text-muted-foreground">პირველად დაკავშირების შემდეგ მიღებული წერილები შეიქმნება დაუმუშავებელ შეკვეთებად და ხელმისაწვდომი იქნება CRM-ის ადმინისტრატორებისა და მენეჯერებისთვის.</p>
          </div>
          <div className="w-full sm:w-auto">{canManage && connectButton}</div>
        </div>
        {!state.canConnect && canManage && (
          <div className="mt-3 rounded-[12px] border border-[#f0d9a8] bg-[#fff4df] p-3 text-[11.5px] text-[#96610b]">
            <p className="font-medium">კავშირი ჯერ მოსამზადებელია — Azure-ის აპლიკაცია არ არის გამართული.</p>
            {state.missing.connect.length > 0 && (
              <p className="mt-1.5">
                შესავსებია:{" "}
                <span className="font-mono max-md:break-all">{state.missing.connect.join(", ")}</span>
              </p>
            )}
            <p className="mt-1.5 opacity-80">ინსტრუქცია: docs/06-outlook-personal-setup.md (პირადი Outlook) ან docs/03-microsoft-365-setup.md (კომპანიის ყუთი).</p>
          </div>
        )}
        {!state.canConnect && !canManage && <p className="mt-3 text-[11.5px] text-[#96610b]">კავშირი ჯერ მოსამზადებელია — მიმართეთ ადმინისტრატორს.</p>}
        {!canManage && <p className="mt-3 text-[11.5px] text-muted-foreground">დაკავშირებისთვის მიმართეთ CRM-ის ადმინისტრატორს.</p>}
      </div>
    );
  }

  return (
    <div className="ln-card ln-enter space-y-3 p-5 max-md:p-4 max-md:break-words">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-[13px] font-medium"><Mail className="size-4 shrink-0 text-[#3457d5] [stroke-width:1.7]" /><span className="break-all">{state.mailbox}</span></p>
          <p className="text-[11.5px] text-muted-foreground">ბოლო შემოწმება: {state.lastRunAt ? formatDate(state.lastRunAt, true) : "ჯერ არ შემოწმებულა"}</p>
          <p className="text-[11.5px] text-muted-foreground">{state.automatic ? "ავტომატური შემოწმება ყოველ 5 წუთში, სერვერის მუშაობისას." : "ავტომატური შემოწმება გამორთულია. გამოიყენეთ „შემოწმება ახლა“."}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto max-md:flex-col max-md:items-stretch max-md:[&>button]:w-full max-md:[&>button]:flex-none max-md:[&>button]:min-h-[44px]">
          <Button size="sm" variant="outline" className="h-11 flex-1 sm:h-8 sm:flex-none" disabled={pending} onClick={() => start(async () => {
            const res = await pollMailNow();
            if (!res.ok) toast.error(res.error);
            else toast.success(`შემოწმდა: ${res.data!.fetched} წერილი, ${res.data!.created} ახალი`);
            router.refresh();
          })}>
            <RefreshCw className={pending ? "size-3 animate-spin" : "size-3"} /> შემოწმება ახლა
          </Button>
          {canManage && state.mode === "outlook" && <>
            {connectButton}
            <ConfirmButton title="Outlook ფოსტის გათიშვა" description="ახალი წერილების მიღება შეჩერდება. უკვე შემოტანილი შეკვეთები დარჩება CRM-ში. Microsoft-ის ანგარიშში გაცემული ნებართვის გაუქმება ცალკე შეგიძლიათ." confirmLabel="გათიშვა" className="max-md:border-transparent max-md:bg-transparent max-md:text-muted-foreground max-md:shadow-none" variant="outline" action={disconnectOutlook}>
              <Unplug className="size-3" /> გათიშვა
            </ConfirmButton>
          </>}
        </div>
      </div>
      {state.lastError && <p role="alert" className="text-xs text-[#b13f32] dark:text-rose-400">{state.lastError}</p>}
    </div>
  );
}

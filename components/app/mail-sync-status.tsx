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
    <Button size="sm" disabled={pending || !state.canConnect} onClick={() => start(() => connectOutlook())}>
      <Mail className="size-4" /> {state.configured ? "ხელახლა დაკავშირება" : "Outlook ფოსტის დაკავშირება"}
    </Button>
  );

  if (!state.configured) {
    return (
      <div className="mb-5 rounded-xl border bg-white p-4 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <h2 className="flex items-center gap-2 text-sm font-medium"><Mail className="size-4 text-blue-600" /> {toMtavruli('Outlook ფოსტა')}</h2>
            <p className="text-sm text-muted-foreground">შეგიძლიათ გამოიყენოთ უფასო Outlook.com ან Hotmail ფოსტა — Microsoft 365-ის ფასიანი გამოწერა საჭირო არ არის.</p>
            <p className="text-xs text-muted-foreground">პირველად დაკავშირების შემდეგ მიღებული წერილები შეიქმნება დაუმუშავებელ შეკვეთებად და ხელმისაწვდომი იქნება CRM-ის ადმინისტრატორებისა და მენეჯერებისთვის.</p>
          </div>
          {canManage && connectButton}
        </div>
        {!state.canConnect && <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">კავშირი ჯერ მოსამზადებელია — Microsoft-ის აპლიკაციის პარამეტრები არ არის გამართული.</p>}
        {!canManage && <p className="mt-3 text-xs text-muted-foreground">დაკავშირებისთვის მიმართეთ CRM-ის ადმინისტრატორს.</p>}
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-3 rounded-xl border bg-white p-4 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium"><Mail className="size-4 shrink-0 text-blue-600" /><span className="break-all">{state.mailbox}</span></p>
          <p className="text-xs text-muted-foreground">ბოლო შემოწმება: {state.lastRunAt ? formatDate(state.lastRunAt, true) : "ჯერ არ შემოწმებულა"}</p>
          <p className="text-xs text-muted-foreground">{state.automatic ? "ავტომატური შემოწმება ყოველ 5 წუთში, სერვერის მუშაობისას." : "ავტომატური შემოწმება გამორთულია. გამოიყენეთ „შემოწმება ახლა“."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
            const res = await pollMailNow();
            if (!res.ok) toast.error(res.error);
            else toast.success(`შემოწმდა: ${res.data!.fetched} წერილი, ${res.data!.created} ახალი`);
            router.refresh();
          })}>
            <RefreshCw className={pending ? "size-3 animate-spin" : "size-3"} /> შემოწმება ახლა
          </Button>
          {canManage && state.mode === "outlook" && <>
            {connectButton}
            <ConfirmButton title="Outlook ფოსტის გათიშვა" description="ახალი წერილების მიღება შეჩერდება. უკვე შემოტანილი შეკვეთები დარჩება CRM-ში. Microsoft-ის ანგარიშში გაცემული ნებართვის გაუქმება ცალკე შეგიძლიათ." confirmLabel="გათიშვა" variant="outline" action={disconnectOutlook}>
              <Unplug className="size-3" /> გათიშვა
            </ConfirmButton>
          </>}
        </div>
      </div>
      {state.lastError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{state.lastError}</p>}
    </div>
  );
}

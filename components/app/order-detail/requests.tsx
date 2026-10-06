"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addColleague } from "@/actions/requests";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

export function ColleagueAdd({ orderId, candidates }: {
  orderId: number;
  candidates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selectedId = candidates.some(candidate => candidate.id === userId) ? userId : "";

  if (!candidates.length) return null;

  function run() {
    if (!selectedId) return;
    setError(null);
    start(async () => {
      try {
        const res = await addColleague(orderId, selectedId);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        setUserId("");
        toast.success("კოლეგა დაემატა");
        router.refresh();
      } catch {
        const message = "კოლეგის დამატება ვერ დადასტურდა. შეამოწმეთ კავშირი და განაახლეთ სია ხელახლა ცდამდე.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
      <NativeSelect aria-label="კოლეგა" value={selectedId} onChange={event => setUserId(event.target.value)} disabled={pending} className="h-11 flex-1 md:max-w-[320px]">
        <option value="">კოლეგა</option>
        {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
      </NativeSelect>
      <Button type="button" className="h-11 whitespace-nowrap" disabled={pending || !selectedId} onClick={run}>{pending ? "…" : "დამატება"}</Button>
      </div>
      {error && <p role="alert" className="text-[13px] leading-5 text-[#b13f32] dark:text-[var(--ln-alert)]">{error}</p>}
    </div>
  );
}

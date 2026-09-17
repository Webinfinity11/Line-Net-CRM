"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { updateQuote } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type QuoteBase = {
  id: number;
  title: string;
  clientId: number | null;
  siteId: number | null;
  systemType: string | null;
  validUntil: string | null;
  vatPercent: string;
  note: string | null;
  terms: string | null;
};

/**
 * Note and terms edit in place. The other fields ride along as hidden inputs because
 * `updateQuote` replaces the whole offer.
 */
export function QuoteNotes({ quote, readOnly }: { quote: QuoteBase; readOnly?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = useRef(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await updateQuote(quote.id, fd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("შენახულია");
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  if (readOnly) {
    return (
      <Card>
        <CardHeader className="pb-1">
          <CardTitle>შენიშვნა და პირობები</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[12.5px]">
          <div>
            <div className="text-[11px] text-muted-foreground">შენიშვნა</div>
            <p className="mt-1 whitespace-pre-wrap">{quote.note || "—"}</p>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">პირობები</div>
            <p className="mt-1 whitespace-pre-wrap">{quote.terms || "—"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>შენიშვნა და პირობები</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <input type="hidden" name="title" value={quote.title} />
          <input type="hidden" name="clientId" value={quote.clientId ?? ""} />
          <input type="hidden" name="siteId" value={quote.siteId ?? ""} />
          <input type="hidden" name="systemType" value={quote.systemType ?? ""} />
          <input type="hidden" name="validUntil" value={quote.validUntil ?? ""} />
          <input type="hidden" name="vatPercent" value={Number(quote.vatPercent)} />
          <div className="space-y-1.5">
            <Label htmlFor="qn-note">შენიშვნა</Label>
            <Textarea id="qn-note" name="note" rows={3} maxLength={4000} defaultValue={quote.note ?? ""} placeholder="რას მოიცავს შეთავაზება" className="text-[16px] sm:text-[13px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qn-terms">პირობები</Label>
            <Textarea id="qn-terms" name="terms" rows={2} maxLength={2000} defaultValue={quote.terms ?? ""} placeholder="გადახდის პირობა, შესრულების ვადა, გარანტია" className="text-[16px] sm:text-[13px]" />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-11 sm:h-9" disabled={pending}>
            {pending ? "ინახება..." : "შენახვა"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

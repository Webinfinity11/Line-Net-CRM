"use client";

import { ListPlus } from "lucide-react";
import { addSitesBulk } from "@/actions/clients";
import { FormDialog } from "@/components/app/form-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** For networks: paste the branch list instead of opening the dialog forty times. */
export function BulkSitesDialog({ clientId }: { clientId: number }) {
  return (
    <FormDialog
      trigger={<Button variant="outline" size="sm" />}
      triggerLabel={
        <>
          <ListPlus className="size-3.5" /> სიით დამატება
        </>
      }
      title="ობიექტების სიით დამატება"
      description="თითო სტრიქონი — თითო ობიექტი. ფორმატი: სახელი, მისამართი"
      action={addSitesBulk.bind(null, clientId)}
      submitLabel="დამატება"
      successMessage="ობიექტები დაემატა"
    >
      <div className="space-y-1.5">
        <Label htmlFor="bulk-lines">სია</Label>
        <Textarea
          id="bulk-lines"
          name="lines"
          rows={8}
          required
          className="text-[16px] sm:text-[13px]"
          placeholder={"ფილიალი ვაკე, ჭავჭავაძის 37\nფილიალი საბურთალო, პეკინის 12\nცენტრალური ოფისი, ბახტრიონის 30"}
        />
        <p className="text-[11px] text-muted-foreground">კოორდინატები მისამართით იძებნება, თუ შესაძლებელია. მაქსიმუმ 200 სტრიქონი.</p>
      </div>
    </FormDialog>
  );
}

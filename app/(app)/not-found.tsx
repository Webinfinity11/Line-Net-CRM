import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toMtavruli } from "@/lib/mtavruli";

/** Missing page or an order the user cannot open. */
export default function AppNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-border bg-card p-6 text-center">
      <span className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-accent text-primary">
        <SearchX className="size-5 [stroke-width:1.7]" />
      </span>
      <h2 className="font-heading text-[18px]">{toMtavruli("გვერდი ვერ მოიძებნა")}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">ასეთი გვერდი არ არსებობს ან მასზე წვდომა არ გაქვთ.</p>
      <Button render={<Link href="/" />} className="mt-4 h-11 sm:h-9">
        მთავარ გვერდზე
      </Button>
    </div>
  );
}

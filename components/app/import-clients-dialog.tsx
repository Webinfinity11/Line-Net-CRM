"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importClientsFromExcel } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ImportClientsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await importClientsFromExcel(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`დაემატა ${res.data!.clients} კლიენტი, ${res.data!.sites} ობიექტი${res.data!.skipped ? `, ${res.data!.skipped} სტრიქონი გამოტოვდა` : ""}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FileSpreadsheet className="size-4" /> იმპორტი Excel
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>კლიენტების იმპორტი Excel-დან</DialogTitle>
          <DialogDescription>
            სვეტები: კომპანია, ს/კ, კონტაქტი, ტელეფონი, ელფოსტა, ობიექტი, მისამართი. ერთი სტრიქონი = ერთი ობიექტი; ერთი კომპანია რამდენიმე სტრიქონში შეიძლება იყოს.{" "}
            <a href="/api/export?type=clients-template" className="text-blue-600 hover:underline">
              შაბლონის ჩამოტვირთვა
            </a>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input type="file" name="file" accept=".xlsx,.xls" required className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              გაუქმება
            </Button>
            <Button type="submit" disabled={pending}>
              <Upload className="size-4" /> {pending ? "იტვირთება..." : "იმპორტი"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

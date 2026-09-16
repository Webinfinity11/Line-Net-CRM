"use client";

import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { deleteAttachment, uploadAttachment } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, t } from "@/lib/i18n";

type Attachment = { id: number; fileName: string; mimeType: string | null; size: number; createdAt: Date };

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({ orderId, attachments, canDelete }: { orderId: number; attachments: Attachment[]; canDelete: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    start(async () => {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadAttachment(orderId, fd);
        if (!res.ok) toast.error(`${file.name}: ${res.error}`);
      }
      if (input.current) input.current.value = "";
      toast.success("ფაილი აიტვირთა");
      router.refresh();
    });
  }

  function remove(id: number) {
    start(async () => {
      const res = await deleteAttachment(id);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          {t.order.attachments} <span className="ml-1 text-sm font-normal text-muted-foreground">{attachments.length}</span>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={pending}>
          <Upload className="size-3.5" /> {pending ? "იტვირთება..." : "ატვირთვა"}
        </Button>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip" />
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="size-4" /> ფაილები არ არის. ფოტოები, PDF, ნახაზები.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {attachments.map((a) => {
              const img = a.mimeType?.startsWith("image/");
              return (
                <li key={a.id} className="flex items-center gap-2.5 rounded-lg border p-2">
                  <a href={`/api/files/${a.id}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/files/${a.id}`} alt="" className="size-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-800">
                        {a.mimeType === "application/pdf" ? <FileText className="size-5 text-rose-600" /> : <ImageIcon className="size-5 text-muted-foreground" />}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium hover:text-sky-700">{a.fileName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fmtSize(a.size)} · {formatDate(a.createdAt)}
                      </span>
                    </span>
                  </a>
                  {canDelete && (
                    <Button variant="ghost" size="icon-xs" onClick={() => remove(a.id)} disabled={pending} aria-label="წაშლა">
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

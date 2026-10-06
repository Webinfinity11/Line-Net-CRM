"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Photo = { id: number; fileName: string };

export function PortalPhotoGallery({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState<Photo | null>(null);
  const [failed, setFailed] = useState(false);
  return <>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {photos.map(photo => <button key={photo.id} type="button"
        onClick={() => { setFailed(false); setSelected(photo); }}
        className="aspect-square min-w-0 cursor-zoom-in overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`ფოტოს გახსნა: ${photo.fileName}`}>
        {/* Authenticated images use the protected file route. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/files/${photo.id}`} alt={photo.fileName} loading="lazy" className="h-full w-full object-cover" />
      </button>)}
    </div>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle>ფოტოანგარიში</DialogTitle>
          <DialogDescription className="break-words">{selected?.fileName}</DialogDescription>
        </DialogHeader>
        {selected && (failed ? <p role="alert" className="py-8 text-center text-sm text-[#b13f32] dark:text-[var(--ln-alert)]">ფოტო ვერ ჩაიტვირთა. დახურეთ ფანჯარა და სცადეთ თავიდან.</p> :
          // eslint-disable-next-line @next/next/no-img-element
          <img key={selected.id} src={`/api/files/${selected.id}`} alt={selected.fileName}
            onError={() => setFailed(true)} className="max-h-[70dvh] w-full rounded-lg bg-[#f5f7fb] dark:bg-muted object-contain" />)}
      </DialogContent>
    </Dialog>
  </>;
}

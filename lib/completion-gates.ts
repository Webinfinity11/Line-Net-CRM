/**
 * Shared UI/server rules. The server always supplies persisted attachments and items.
 * A technician's handover must carry a note, their own photo and every required checklist item before it reaches the manager.
 * Staff finishing or closing an order themselves only write the note: they may be closing work done by phone or remotely.
 */
export function completionProblems({ note, attachments, checklist, executorId, staff = false }: {
  note: string;
  attachments: { mimeType: string | null; uploadedBy?: string | null }[];
  checklist: { label: string; required: boolean; done: boolean }[];
  executorId?: string;
  staff?: boolean;
}): string[] {
  const problems: string[] = [];
  if (note.trim().length < 5) problems.push("მოკლედ აღწერეთ, რა გაკეთდა (მინ. 5 სიმბოლო)");
  if (staff) return problems;
  if (!attachments.some(a => a.mimeType?.startsWith("image/") && (executorId === undefined || a.uploadedBy === executorId))) problems.push("დაამატეთ ერთი ფოტო მაინც");
  const missing = checklist.filter(i => i.required && !i.done);
  if (missing.length) problems.push(`მონიშნეთ სავალდებულო პუნქტები: ${missing.map(i => i.label).join(", ")}`);
  return problems;
}

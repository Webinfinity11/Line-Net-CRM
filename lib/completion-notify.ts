/** Pure recipient and text helpers for handover notifications. */
export function completionRecipients(input: {
  managerId: string | null;
  staffIds: string[];
  adminIds: string[];
  actorId: string;
}): string[] {
  return [...new Set([...(input.managerId ? [input.managerId] : input.staffIds), ...input.adminIds])]
    .filter((id) => Boolean(id) && id !== input.actorId);
}

type OrderDetails = { number: string; siteName?: string | null };
type CompletionDetails = OrderDetails & { actorName: string };

export function completionTexts(input: CompletionDetails & { partial: boolean }) {
  return {
    title: `ჩაბარდა ${input.number} · ${input.siteName || "—"}`,
    body: `შემსრულებელი: ${input.actorName} · ${input.partial ? "ნაწილი" : "სამუშაო დასრულებულია"}`,
  };
}

export function clientCompletedText(input: CompletionDetails) {
  return {
    title: `${input.number} ჩაბარდა · ${input.siteName || "—"}`,
    body: `შემსრულებელი: ${input.actorName} · მენეჯერი ამოწმებს`,
  };
}

export function clientClosedText(input: OrderDetails) {
  return {
    title: `${input.number} შესრულებულია · ${input.siteName || "—"}`,
    body: "სამუშაო დადასტურებულია",
  };
}

// Pure helpers for order-comment notifications (no db, safe for tests).

export const COMMENT_PREVIEW_LENGTH = 80;

/** The order's manager (or every staff member when nobody manages it) plus the assignees; never the author or clients. */
export function commentRecipients(input: {
  authorId: string;
  managerId: string | null;
  staffIds: string[];
  assigneeIds: string[];
  clientIds?: string[];
}): string[] {
  const excluded = new Set([input.authorId, ...(input.clientIds ?? [])]);
  const candidates = [...(input.managerId ? [input.managerId] : input.staffIds), ...input.assigneeIds];
  return [...new Set(candidates)].filter((id) => id && !excluded.has(id));
}

/** Drops people who still have an unread comment notification for this order. */
export function withoutAlreadyNotified(recipients: string[], alreadyUnread: string[]): string[] {
  const skip = new Set(alreadyUnread);
  return recipients.filter((id) => !skip.has(id));
}

export function commentNotification(authorName: string, orderNumber: string, body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  const preview = text.length > COMMENT_PREVIEW_LENGTH ? `${text.slice(0, COMMENT_PREVIEW_LENGTH - 1).trimEnd()}…` : text;
  return { type: "comment" as const, title: `ახალი შეტყობინება ${orderNumber}`, body: `${authorName}: ${preview}` };
}

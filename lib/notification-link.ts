/** Shared by the initial bell, polling API and notifications page. */
export function notificationLink(role: string, item: { orderId: number | null; type: string }): string | null {
  if (item.orderId === null || item.type === "request_declined") return null;
  if (role === "client") return `/portal/orders/${item.orderId}`;
  return `/orders/${item.orderId}${item.type === "comment" ? "#comments" : ""}`;
}

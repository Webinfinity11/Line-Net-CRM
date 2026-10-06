import type { OrderPriority, OrderStatus, OrderType, PaymentStatus, ScheduleFrequency, SystemType, UserRole } from "@/db/schema";
import { systemTypeEnum } from "@/db/schema";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "ახალი",
  assigned: "დანიშნული",
  in_progress: "მიმდინარე",
  done: "შესრულებული",
  closed: "დახურული",
  cancelled: "გაუქმებული",
};

export const STATUS_ORDER: OrderStatus[] = ["new", "assigned", "in_progress", "done", "closed", "cancelled"];
export const ACTIVE_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress"];
export const KANBAN_STATUSES: OrderStatus[] = ["new", "assigned", "in_progress", "done", "closed"];

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "bg-[#f6fafb] text-[#397b83] dark:bg-[#326b72]/40 dark:text-[#a5cdd1]",
  assigned: "bg-[#f1eefa] text-[#6a5a92] dark:bg-violet-900/40 dark:text-violet-200",
  in_progress: "bg-[#fdf3e3] text-[#8a6a2f] dark:bg-amber-900/40 dark:text-amber-200",
  done: "bg-[#eaf4ee] text-[#35735a] dark:bg-emerald-900/40 dark:text-emerald-200",
  closed: "bg-[#eef1f5] text-[#65717f] dark:bg-neutral-800 dark:text-neutral-300",
  cancelled: "bg-[#faeeee] text-[#96504e] dark:bg-rose-900/40 dark:text-rose-200",
};

/** Soft fills for job cards on calendars and day strips (paired with STATUS_HEX for the accent). */
export const STATUS_TINT: Record<OrderStatus, string> = {
  new: "var(--ln-status-new-bg, #edf6f7)",
  assigned: "var(--ln-status-assigned-bg, #f0ecfc)",
  in_progress: "var(--ln-status-in_progress-bg, #fff4df)",
  done: "var(--ln-status-done-bg, #eaf6ef)",
  closed: "var(--ln-status-closed-bg, #eef1f5)",
  cancelled: "var(--ln-status-cancelled-bg, #fdeeee)",
};

export const STATUS_HEX: Record<OrderStatus, string> = {
  new: "#397b83",
  assigned: "#7251ad",
  in_progress: "#d18a12",
  done: "#23764f",
  closed: "#93a0b0",
  cancelled: "#c2504f",
};

export const TYPE_LABELS: Record<OrderType, string> = {
  service: "გამოძახება",
  project: "პროექტი",
};

export const PRIORITY_LABELS: Record<OrderPriority, string> = {
  low: "დაბალი",
  normal: "ჩვეულებრივი",
  high: "მაღალი",
  urgent: "სასწრაფო",
};

export const PRIORITY_COLORS: Record<OrderPriority, string> = {
  low: "bg-[#f1f4f9] text-[#617084] dark:bg-muted dark:text-muted-foreground",
  normal: "bg-[#f1f4f9] text-[#617084] dark:bg-muted dark:text-muted-foreground",
  high: "bg-[#fff4df] text-[#96610b] border border-[#f0d9a8] dark:bg-[var(--ln-warn-bg)] dark:text-[var(--ln-warn)] dark:border-[var(--ln-warn-line)]",
  urgent: "bg-[#faeeee] text-[#b13f32] dark:bg-[var(--ln-alert-bg)] dark:text-[var(--ln-alert)]",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "გადაუხდელი",
  partial: "ნაწილობრივ გადახდილი",
  paid: "გადახდილი",
};

export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-[#faeeee] text-[#b13f32] dark:bg-rose-900/40 dark:text-rose-200",
  partial: "bg-[#fff4df] text-[#96610b] dark:bg-amber-900/40 dark:text-amber-200",
  paid: "bg-[#eaf6ef] text-[#25815a] dark:bg-emerald-900/40 dark:text-emerald-200",
};

export const SYSTEM_LABELS: Record<SystemType, string> = {
  fire: "ხანძარსაწინააღმდეგო",
  electrical: "ელექტრო",
  network: "IT / ქსელი",
  design: "პროექტირება",
  cctv: "CCTV",
  access: "წვდომის კონტროლი",
  lighting: "განათება",
  cable_trays: "კაბელტრასები",
  automation: "ავტომატიზაცია (BMS)",
  structured_cabling: "სტრუქტურული კაბელირება",
  other: "სხვა",
};
export const SYSTEM_ORDER: SystemType[] = ["fire", "electrical", "network", "cctv", "access", "lighting", "automation", "structured_cabling", "cable_trays", "design", "other"];

/**
 * Systems are a taxonomy, not a state: one neutral chip for all of them.
 * Colour in a row is reserved for status (what to do) and problems (overdue, unpaid).
 */
export const SYSTEM_COLORS: Record<SystemType, string> = Object.fromEntries(
  systemTypeEnum.enumValues.map((k) => [k, "bg-[#f1f4f9] text-[#617084] dark:bg-neutral-800 dark:text-neutral-300"]),
) as Record<SystemType, string>;


export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  weekly: "ყოველკვირა",
  monthly: "ყოველთვე",
  quarterly: "კვარტალში ერთხელ",
  semiannual: "6 თვეში ერთხელ",
  annual: "წელიწადში ერთხელ",
};

/** What a client sees in the portal: the stage of their request, not the internal workflow. */
export const PORTAL_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "მიღებულია",
  assigned: "დაგეგმილია",
  in_progress: "მიმდინარეობს",
  done: "შემოწმებას ელოდება",
  closed: "შესრულებულია",
  cancelled: "გაუქმებულია",
};

export function portalStatusLabel(status: OrderStatus, triaged: boolean): string {
  return triaged ? PORTAL_STATUS_LABELS[status] : "გაგზავნილია";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "ადმინი",
  manager: "მენეჯერი",
  executor: "შემსრულებელი",
  client: "კლიენტი",
};

export const EVENT_LABELS: Record<string, string> = {
  client_edited: "კლიენტმა შეცვალა განაცხადი",
  self_assigned: "აიღო",
  assignee_done: "შემსრულებელმა ჩააბარა",
  request_approved: "დანიშვნის მოთხოვნა დადასტურდა",
  request_declined: "დანიშვნის მოთხოვნა უარყოფილია",
  created: "შეკვეთა შეიქმნა",
  created_from_email: "შეიქმნა ელფოსტიდან",
  status_changed: "სტატუსი შეიცვალა",
  assigned: "დაენიშნა შემსრულებელი",
  unassigned: "მოეხსნა შემსრულებელი",
  updated: "განახლდა",
  payment_changed: "გადახდის სტატუსი შეიცვალა",
  attachment_added: "დაემატა ფაილი",
  triaged: "მენეჯერმა დაამუშავა",
  arrived: "მივიდა ობიექტზე",
  finished: "დაასრულა სამუშაო",
  material_added: "დაემატა მასალა",
  material_removed: "წაიშალა მასალა",
  created_from_schedule: "შეიქმნა გრაფიკით",
  visit_started: "ვიზიტი დაიწყო",
  visit_ended: "ვიზიტი დასრულდა",
  payment_added: "გადახდა დაფიქსირდა",
  payment_removed: "გადახდა წაიშალა",
  payment_reviewed: "გადახდა დაზუსტდა",
  verified_closed: "შემოწმდა და დაიხურა",
  reopened: "დახურული შეკვეთა გაიხსნა",
  edited_closed: "დახურული შეკვეთა შეიცვალა (ადმინი)",
  attachment_removed: "წაიშალა ფაილი",
  scheduled: "დაიგეგმა",
};

export const t = {
  appName: "Line Net CRM",
  nav: {
    dashboard: "დაფა",
    orders: "შეკვეთები",
    inbox: "შემოსულები",
    my: "ჩემი შეკვეთები",
    clients: "კლიენტები",
    users: "მომხმარებლები",
    settings: "პარამეტრები",
    logout: "გასვლა",
  },
  common: {
    save: "შენახვა",
    cancel: "გაუქმება",
    create: "შექმნა",
    edit: "რედაქტირება",
    delete: "წაშლა",
    search: "ძებნა",
    all: "ყველა",
    none: "არ არის",
    loading: "იტვირთება…",
    noResults: "ჩანაწერები არ მოიძებნა",
    today: "დღეს",
    week: "კვირა",
    month: "თვე",
    actions: "მოქმედებები",
    back: "უკან",
    yes: "კი",
    no: "არა",
  },
  order: {
    one: "შეკვეთა",
    many: "შეკვეთები",
    new: "ახალი შეკვეთა",
    number: "ნომერი",
    title: "სათაური",
    description: "აღწერა",
    type: "ტიპი",
    status: "სტატუსი",
    priority: "პრიორიტეტი",
    client: "კლიენტი",
    site: "ობიექტი",
    address: "მისამართი",
    dueDate: "ვადა",
    amount: "თანხა",
    paymentStatus: "გადახდის სტატუსი",
    assignees: "შემსრულებლები",
    attachments: "დანართები",
    comments: "შეტყობინებები",
    history: "ისტორია",
    createdAt: "შეიქმნა",
    createdBy: "შემქმნელი",
    source: "წყარო",
    overdue: "ვადაგადაცილებული",
    unassigned: "დაუნიშნავი",
    system: "კატეგორია",
    scheduledAt: "დაგეგმილი დრო",
    warranty: "გარანტია",
    materials: "მასალები",
    timeOnSite: "დრო ობიექტზე",
  },
  nav2: {
    schedule: "განრიგი",
    maintenance: "ტექმომსახურება",
    reports: "ანგარიშები",
    notifications: "შეტყობინებები",
    profile: "პროფილი",
  },
};

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, true);
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} წთ`;
  return m ? `${h} სთ ${m} წთ` : `${h} სთ`;
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  // manual formatting: Intl currency output differs between Node and browsers (hydration mismatch)
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${grouped},${dec} ₾`;
}

const TBILISI_TZ = "Asia/Tbilisi";

export function formatDate(value: Date | string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  // en-GB + formatToParts is available everywhere and gives identical output on server and client
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TBILISI_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("day")}.${get("month")}.${get("year")}`;
  return withTime ? `${date}, ${get("hour")}:${get("minute")}` : date;
}

export const CLIENT_EDIT_FIELD_LABELS: Record<string, string> = {
  title: "სათაური", description: "აღწერა", systemType: "კატეგორია", siteId: "ობიექტი", address: "მისამართი", priority: "სასწრაფოობა",
};

export function clientEditedEventText(data: Record<string, unknown> | null): string {
  const changes = Array.isArray(data?.changes) ? data.changes : [];
  const details = changes.flatMap(change => {
    if (!change || typeof change !== "object" || typeof change.field !== "string") return [];
    const value = (v: unknown) => v == null || v === "" ? "—" : change.field === "priority" ? (PRIORITY_LABELS[v as keyof typeof PRIORITY_LABELS] ?? String(v)) : String(v);
    return [`${CLIENT_EDIT_FIELD_LABELS[change.field] ?? change.field} „${value(change.from)}“ → „${value(change.to)}“`];
  });
  return `${EVENT_LABELS.client_edited}${details.length ? `: ${details.join("; ")}` : ""}`;
}

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
  new: "bg-[#eef2fb] text-[#3d5a8a] dark:bg-blue-900/40 dark:text-blue-200",
  assigned: "bg-[#f1eefa] text-[#6a5a92] dark:bg-violet-900/40 dark:text-violet-200",
  in_progress: "bg-[#fdf3e3] text-[#8a6a2f] dark:bg-amber-900/40 dark:text-amber-200",
  done: "bg-[#eaf4ee] text-[#35735a] dark:bg-emerald-900/40 dark:text-emerald-200",
  closed: "bg-[#eef1f5] text-[#65717f] dark:bg-neutral-800 dark:text-neutral-300",
  cancelled: "bg-[#faeeee] text-[#96504e] dark:bg-rose-900/40 dark:text-rose-200",
};

/** Soft fills for job cards on calendars and day strips (paired with STATUS_HEX for the accent). */
export const STATUS_TINT: Record<OrderStatus, string> = {
  new: "#edf2ff",
  assigned: "#f0ecfc",
  in_progress: "#fff4df",
  done: "#eaf6ef",
  closed: "#eef1f5",
  cancelled: "#fdeeee",
};

export const STATUS_HEX: Record<OrderStatus, string> = {
  new: "#3457d5",
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
  low: "text-slate-400",
  normal: "text-slate-600 dark:text-neutral-300",
  high: "text-amber-600 font-medium",
  urgent: "text-rose-600 font-semibold",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "გადაუხდელი",
  partial: "ნაწილობრივ",
  paid: "გადახდილი",
};

export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
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
  systemTypeEnum.enumValues.map((k) => [k, "bg-[#f1f4f9] text-[#5b6b7c] dark:bg-neutral-800 dark:text-neutral-300"]),
) as Record<SystemType, string>;


export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  weekly: "ყოველკვირა",
  monthly: "ყოველთვე",
  quarterly: "კვარტალში ერთხელ",
  semiannual: "6 თვეში ერთხელ",
  annual: "წელიწადში ერთხელ",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "ადმინი",
  manager: "მენეჯერი",
  executor: "შემსრულებელი",
};

export const EVENT_LABELS: Record<string, string> = {
  created: "შეკვეთა შეიქმნა",
  created_from_email: "შეიქმნა ელფოსტიდან",
  status_changed: "სტატუსი შეიცვალა",
  assigned: "დაენიშნა შემსრულებელი",
  unassigned: "მოეხსნა შემსრულებელი",
  updated: "განახლდა",
  payment_changed: "გადახდის სტატუსი შეიცვალა",
  attachment_added: "დაემატა ფაილი",
  triaged: "დამუშავდა მენეჯერის მიერ",
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
    loading: "იტვირთება...",
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
    comments: "კომენტარები",
    history: "ისტორია",
    createdAt: "შეიქმნა",
    createdBy: "შემქმნელი",
    source: "წყარო",
    overdue: "ვადაგადაცილებული",
    unassigned: "დაუნიშნავი",
    system: "სისტემა",
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

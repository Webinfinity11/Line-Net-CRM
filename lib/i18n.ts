import type { OrderPriority, OrderStatus, OrderType, PaymentStatus, ScheduleFrequency, SystemType, UserRole } from "@/db/schema";

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
  new: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  assigned: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  closed: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  cancelled: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

export const STATUS_HEX: Record<OrderStatus, string> = {
  new: "#0ea5e9",
  assigned: "#8b5cf6",
  in_progress: "#f59e0b",
  done: "#10b981",
  closed: "#737373",
  cancelled: "#f43f5e",
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
  low: "text-neutral-500",
  normal: "text-neutral-700 dark:text-neutral-300",
  high: "text-orange-600",
  urgent: "text-red-600 font-semibold",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "გადაუხდელი",
  partial: "ნაწილობრივ",
  paid: "გადახდილი",
};

export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
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

export const SYSTEM_COLORS: Record<SystemType, string> = {
  fire: "bg-red-50 text-red-700 ring-1 ring-red-200",
  electrical: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200",
  network: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  design: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
  cctv: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  access: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  lighting: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  cable_trays: "bg-stone-50 text-stone-700 ring-1 ring-stone-200",
  automation: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  structured_cabling: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200",
  other: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
};

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
  checklist_done: "ჩეკ-ლისტი შესრულდა",
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
  checklist_template_applied: "დაემატა ჩეკ-ლისტის შაბლონი",
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
    checklist: "ჩეკ-ლისტი",
    timeOnSite: "დრო ობიექტზე",
  },
  nav2: {
    schedule: "განრიგი",
    maintenance: "ტექმომსახურება",
    reports: "ანგარიშები",
    notifications: "შეტყობინებები",
    profile: "პროფილი",
    checklists: "ჩეკ-ლისტები",
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
  return new Intl.NumberFormat("ka-GE", { style: "currency", currency: "GEL", maximumFractionDigits: 2 }).format(n);
}

export function formatDate(value: Date | string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ka-GE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

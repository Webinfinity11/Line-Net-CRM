import type { OrderPriority, OrderStatus, OrderType, SystemType } from "@/db/schema";

/** Serializable order row for the dashboard board (dates are pre-formatted on the server). */
export type BoardOrder = {
  id: number;
  number: string;
  title: string;
  status: OrderStatus;
  priority: OrderPriority;
  type: OrderType;
  systemType: SystemType | null;
  dueDate: string | null;
  scheduledAt: string | null;
  /** "HH:MM" in Tbilisi time, or null when unscheduled */
  timeLabel: string | null;
  /** "dd.mm.yyyy, HH:MM" in Tbilisi time */
  scheduledLabel: string | null;
  plannedMinutes: number | null;
  description: string | null;
  client: { id: number; name: string } | null;
  site: { id: number; name: string; address: string | null } | null;
  assignees: { id: string; name: string; image: string | null }[];
  overdue: boolean;
};

export type BoardFilter = "all" | "unassigned" | "overdue" | "review";

export type Executor = { id: string; name: string; image: string | null };

export type Visit = { id: number; time: string; client: string; executor: string; site: string };

export type WorkloadRow = { id: string; name: string; image: string | null; hours: number };

export type MailPeek = { configured: boolean; count: number; connectHref: string };

export type ClientOption = { id: number; name: string };

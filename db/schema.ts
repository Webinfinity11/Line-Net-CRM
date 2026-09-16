import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  uniqueIndex,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (user / session / account / verification) + admin plugin
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // admin plugin
  role: text("role").notNull().default("executor"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  // custom
  phone: text("phone"),
  specializations: text("specializations").array().notNull().default(sql`'{}'::text[]`),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

export const orderTypeEnum = pgEnum("order_type", ["service", "project"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "assigned",
  "in_progress",
  "done",
  "closed",
  "cancelled",
]);
export const orderPriorityEnum = pgEnum("order_priority", ["low", "normal", "high", "urgent"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "partial", "paid"]);
export const orderSourceEnum = pgEnum("order_source", ["manual", "email", "schedule"]);
export const systemTypeEnum = pgEnum("system_type", [
  "fire",
  "electrical",
  "network",
  "design",
  "cctv",
  "access",
  "lighting",
  "cable_trays",
  "automation",
  "structured_cabling",
  "other",
]);
export const frequencyEnum = pgEnum("schedule_frequency", ["weekly", "monthly", "quarterly", "semiannual", "annual"]);

export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderPriority = (typeof orderPriorityEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type OrderSource = (typeof orderSourceEnum.enumValues)[number];
export type SystemType = (typeof systemTypeEnum.enumValues)[number];
export type ScheduleFrequency = (typeof frequencyEnum.enumValues)[number];
export type UserRole = "admin" | "manager" | "executor";

// ---------------------------------------------------------------------------
// Clients and sites
// ---------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  idCode: text("id_code"),
  phone: text("phone"),
  email: text("email"),
  contactName: text("contact_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sites = pgTable(
  "sites",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sites_client_idx").on(t.clientId)],
);

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number")
      .notNull()
      .generatedAlwaysAs(sql`'LN-' || lpad(id::text, 5, '0')`),
    title: text("title").notNull(),
    description: text("description"),
    type: orderTypeEnum("type").notNull().default("service"),
    status: orderStatusEnum("status").notNull().default("new"),
    priority: orderPriorityEnum("priority").notNull().default("normal"),
    systemType: systemTypeEnum("system_type"),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    address: text("address"),
    dueDate: date("due_date"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    warrantyMonths: integer("warranty_months"),
    warrantyUntil: date("warranty_until"),
    scheduleId: integer("schedule_id"),
    plannedMinutes: integer("planned_minutes"),
    requiresPhoto: boolean("requires_photo").notNull().default(false),
    completionNote: text("completion_note"),
    verifiedBy: text("verified_by").references(() => user.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    paidTotal: numeric("paid_total", { precision: 12, scale: 2 }).notNull().default("0"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    paymentReviewNeeded: boolean("payment_review_needed").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    source: orderSourceEnum("source").notNull().default("manual"),
    triaged: boolean("triaged").notNull().default(true),
    emailFrom: text("email_from"),
    emailSubject: text("email_subject"),
    emailMessageId: text("email_message_id").unique(),
    emailReceivedAt: timestamp("email_received_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_client_idx").on(t.clientId),
    index("orders_due_idx").on(t.dueDate),
    index("orders_created_idx").on(t.createdAt),
    index("orders_scheduled_idx").on(t.scheduledAt),
    index("orders_system_idx").on(t.systemType),
  ],
);

export const orderMaterials = pgTable(
  "order_materials",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
    unit: text("unit").notNull().default("ცალი"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("materials_order_idx").on(t.orderId)],
);

export type ChecklistTemplateItem = { label: string; required?: boolean };

export const checklistTemplates = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  systemType: systemTypeEnum("system_type").notNull(),
  name: text("name").notNull(),
  items: jsonb("items").$type<ChecklistTemplateItem[]>().notNull().default([]),
  isDefault: boolean("is_default").notNull().default(false),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderChecklistItems = pgTable(
  "order_checklist_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    label: text("label").notNull(),
    required: boolean("required").notNull().default(false),
    done: boolean("done").notNull().default(false),
    doneBy: text("done_by").references(() => user.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [index("checklist_order_idx").on(t.orderId)],
);

export const orderPayments = pgTable(
  "order_payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    method: text("method").notNull().default("transfer"),
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_paid_at_idx").on(t.paidAt)],
);

export const orderVisits = pgTable(
  "order_visits",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("visits_order_idx").on(t.orderId),
    index("visits_user_idx").on(t.userId, t.startedAt),
    uniqueIndex("visits_active_unique").on(t.orderId, t.userId).where(sql`${t.endedAt} is null`),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteEquipment = pgTable(
  "site_equipment",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    systemType: systemTypeEnum("system_type"),
    name: text("name").notNull(),
    model: text("model"),
    serial: text("serial"),
    quantity: integer("quantity").notNull().default(1),
    installedAt: date("installed_at"),
    warrantyUntil: date("warranty_until"),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("equipment_site_idx").on(t.siteId)],
);

export const serviceSchedules = pgTable(
  "service_schedules",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    systemType: systemTypeEnum("system_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    frequency: frequencyEnum("frequency").notNull().default("monthly"),
    nextDate: date("next_date").notNull(),
    leadDays: integer("lead_days").notNull().default(7),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    assigneeIds: text("assignee_ids").array().notNull().default(sql`'{}'::text[]`),
    checklistTemplateId: integer("checklist_template_id").references(() => checklistTemplates.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("schedules_client_idx").on(t.clientId), index("schedules_next_idx").on(t.nextDate)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const orderAssignees = pgTable(
  "order_assignees",
  {
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.userId] }), index("assignees_user_idx").on(t.userId)],
);

export const orderComments = pgTable(
  "order_comments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_order_idx").on(t.orderId)],
);

export const orderAttachments = pgTable(
  "order_attachments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    size: integer("size").notNull().default(0),
    storagePath: text("storage_path").notNull(),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_order_idx").on(t.orderId)],
);

// Keeps track of the Graph mailbox polling cursor
export const mailSync = pgTable("mail_sync", {
  mailbox: text("mailbox").primaryKey(),
  lastReceivedAt: timestamp("last_received_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastError: text("last_error"),
});

// One shared inbox connection for this CRM. Tokens are encrypted on the server.
export const outlookConnection = pgTable("outlook_connection", {
  id: text("id").primaryKey().default("shared"),
  accountId: text("account_id").notNull(),
  mailbox: text("mailbox").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  connectedBy: text("connected_by").references(() => user.id, { onDelete: "set null" }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  assignments: many(orderAssignees),
  comments: many(orderComments),
}));

export const clientRelations = relations(clients, ({ many }) => ({
  sites: many(sites),
  orders: many(orders),
}));

export const siteRelations = relations(sites, ({ one, many }) => ({
  client: one(clients, { fields: [sites.clientId], references: [clients.id] }),
  orders: many(orders),
  equipment: many(siteEquipment),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  site: one(sites, { fields: [orders.siteId], references: [sites.id] }),
  creator: one(user, { fields: [orders.createdBy], references: [user.id], relationName: "creator" }),
  verifier: one(user, { fields: [orders.verifiedBy], references: [user.id], relationName: "verifier" }),
  assignees: many(orderAssignees),
  comments: many(orderComments),
  attachments: many(orderAttachments),
  events: many(orderEvents),
  materials: many(orderMaterials),
  checklist: many(orderChecklistItems),
  payments: many(orderPayments),
  visits: many(orderVisits),
}));

export const orderPaymentRelations = relations(orderPayments, ({ one }) => ({
  order: one(orders, { fields: [orderPayments.orderId], references: [orders.id] }),
  creator: one(user, { fields: [orderPayments.createdBy], references: [user.id] }),
}));

export const orderVisitRelations = relations(orderVisits, ({ one }) => ({
  order: one(orders, { fields: [orderVisits.orderId], references: [orders.id] }),
  user: one(user, { fields: [orderVisits.userId], references: [user.id] }),
}));

export const orderMaterialRelations = relations(orderMaterials, ({ one }) => ({
  order: one(orders, { fields: [orderMaterials.orderId], references: [orders.id] }),
}));

export const orderChecklistRelations = relations(orderChecklistItems, ({ one }) => ({
  order: one(orders, { fields: [orderChecklistItems.orderId], references: [orders.id] }),
  doneByUser: one(user, { fields: [orderChecklistItems.doneBy], references: [user.id] }),
}));

export const siteEquipmentRelations = relations(siteEquipment, ({ one }) => ({
  site: one(sites, { fields: [siteEquipment.siteId], references: [sites.id] }),
}));

export const serviceScheduleRelations = relations(serviceSchedules, ({ one }) => ({
  client: one(clients, { fields: [serviceSchedules.clientId], references: [clients.id] }),
  site: one(sites, { fields: [serviceSchedules.siteId], references: [sites.id] }),
  checklistTemplate: one(checklistTemplates, { fields: [serviceSchedules.checklistTemplateId], references: [checklistTemplates.id] }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
  order: one(orders, { fields: [notifications.orderId], references: [orders.id] }),
}));

export const orderAssigneeRelations = relations(orderAssignees, ({ one }) => ({
  order: one(orders, { fields: [orderAssignees.orderId], references: [orders.id] }),
  user: one(user, { fields: [orderAssignees.userId], references: [user.id] }),
}));

export const orderCommentRelations = relations(orderComments, ({ one }) => ({
  order: one(orders, { fields: [orderComments.orderId], references: [orders.id] }),
  user: one(user, { fields: [orderComments.userId], references: [user.id] }),
}));

export const orderAttachmentRelations = relations(orderAttachments, ({ one }) => ({
  order: one(orders, { fields: [orderAttachments.orderId], references: [orders.id] }),
}));

export const orderEventRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
  user: one(user, { fields: [orderEvents.userId], references: [user.id] }),
}));

export type Order = typeof orders.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type User = typeof user.$inferSelect;
export type OrderMaterial = typeof orderMaterials.$inferSelect;
export type ChecklistItem = typeof orderChecklistItems.$inferSelect;
export type SiteEquipment = typeof siteEquipment.$inferSelect;
export type ServiceSchedule = typeof serviceSchedules.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type OrderPayment = typeof orderPayments.$inferSelect;
export type OrderVisit = typeof orderVisits.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;

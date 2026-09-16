import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
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
export const orderSourceEnum = pgEnum("order_source", ["manual", "email"]);

export type OrderType = (typeof orderTypeEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderPriority = (typeof orderPriorityEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type OrderSource = (typeof orderSourceEnum.enumValues)[number];
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
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    address: text("address"),
    dueDate: date("due_date"),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
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
  ],
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
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  site: one(sites, { fields: [orders.siteId], references: [sites.id] }),
  creator: one(user, { fields: [orders.createdBy], references: [user.id] }),
  assignees: many(orderAssignees),
  comments: many(orderComments),
  attachments: many(orderAttachments),
  events: many(orderEvents),
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

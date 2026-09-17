/**
 * Seeds an admin, a manager, a few executors, clients and demo orders.
 * Run: npm run db:seed
 * Safe to re-run: skips users/clients that already exist.
 */

import { eq } from "drizzle-orm";
import { db } from "./index";
import { sql } from "drizzle-orm";
import { clients, orderAssignees, orderComments, orderEvents, orders, sites, user } from "./schema";

type SeedUser = { email: string; name: string; role: "admin" | "manager" | "executor"; phone?: string; specializations?: string[] };

const USERS: SeedUser[] = [
  { email: "admin@line-net.ge", name: "ადმინისტრატორი", role: "admin", phone: "0322 022 022" },
  { email: "manager@line-net.ge", name: "ნინო მენეჯერი", role: "manager", phone: "555 62 42 82" },
  { email: "giorgi@line-net.ge", name: "გიორგი ბერიძე", role: "executor", phone: "599 11 22 33", specializations: ["cctv", "access", "network", "structured_cabling"] },
  { email: "levan@line-net.ge", name: "ლევან კაპანაძე", role: "executor", phone: "599 44 55 66", specializations: ["fire", "electrical", "lighting"] },
  { email: "dato@line-net.ge", name: "დათო მაისურაძე", role: "executor", phone: "599 77 88 99", specializations: ["electrical", "automation", "cable_trays"] },
];

const PASSWORDS: Record<SeedUser["role"], string> = {
  admin: process.env.SEED_PASSWORD_ADMIN ?? "admin1234",
  manager: process.env.SEED_PASSWORD_MANAGER ?? "meneger1234",
  executor: process.env.SEED_PASSWORD_EXECUTOR ?? "user1234",
};

async function ensureUser(u: SeedUser) {
  const { auth } = await import("@/lib/auth");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(PASSWORDS[u.role]);
  const existing = await db.query.user.findFirst({ where: eq(user.email, u.email) });
  if (existing) {
    // keep demo passwords in sync on re-run
    await ctx.internalAdapter.updatePassword(existing.id, hash);
    return existing;
  }
  const created = await ctx.internalAdapter.createUser({
    email: u.email,
    name: u.name,
    emailVerified: true,
    role: u.role,
    phone: u.phone,
    specializations: u.specializations ?? [],
  } as never, undefined as never);
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: hash,
  } as never);
  return (await db.query.user.findFirst({ where: eq(user.id, created.id) }))!;
}

async function main() {
  const seeded = [] as (typeof user.$inferSelect)[];
  for (const u of USERS) {
    const row = await ensureUser(u);
    if (u.specializations?.length && row.specializations.length === 0) {
      await db.update(user).set({ specializations: u.specializations }).where(eq(user.id, row.id));
    }
    seeded.push(row);
  }

  // backfill system types on demo orders by title keywords
  await db.execute(sql`update orders set system_type = case
      when title ilike '%CCTV%' or title ilike '%კამერ%' then 'cctv'
      when title ilike '%სახანძრო%' or title ilike '%განათების ბატარე%' then 'fire'
      when title ilike '%წვდომ%' or title ilike '%access%' then 'access'
      when title ilike '%WiFi%' or title ilike '%ქსელ%' or title ilike '%ოპტიკ%' then 'network'
      when title ilike '%კაბელირებ%' then 'structured_cabling'
      when title ilike '%BMS%' or title ilike '%ავტომატ%' or title ilike '%კონდიცირ%' then 'automation'
      when title ilike '%ელექტრო%' then 'electrical'
      else system_type end
    where system_type is null`);
  await db.execute(sql`update orders set scheduled_at = (due_date::timestamp + interval '10 hours') at time zone 'Asia/Tbilisi' where scheduled_at is null and due_date is not null and triaged`);
  await db.execute(sql`update orders set warranty_months = 12 where warranty_months is null and type = 'project'`);
  await db.execute(sql`update orders set warranty_until = (completed_at + interval '12 months')::date where warranty_months = 12 and completed_at is not null and warranty_until is null`);

  // demo site coordinates (Tbilisi) where missing
  const coords: Record<string, [number, number]> = {
    "ფილიალი ვაკე": [41.7086, 44.7601],
    "ფილიალი საბურთალო": [41.7256, 44.7476],
    "სათავო ოფისი": [41.7241, 44.7789],
    "სასტუმრო": [41.7062, 44.7883],
    "კლინიკა ვაჟა-ფშაველას 40": [41.7248, 44.7392],
    "კლინიკა ლუბლიანას 21": [41.7756, 44.7628],
    "ცენტრი": [41.7392, 44.8412],
    "m2 ხილიანი": [41.7269, 44.7723],
    "m2 ყაზბეგზე": [41.7213, 44.7566],
  };
  const allSites = await db.select().from(sites);
  for (const st of allSites) {
    const c = coords[st.name];
    if (c && !st.lat) await db.update(sites).set({ lat: c[0].toFixed(7), lng: c[1].toFixed(7) }).where(eq(sites.id, st.id));
  }
  const admin = seeded[0];
  const manager = seeded[1];
  const executors = seeded.slice(2);
  console.log(`users: ${seeded.length} (admin: ${PASSWORDS.admin}, manager: ${PASSWORDS.manager}, executor: ${PASSWORDS.executor})`);

  if (process.env.SEED_ACCOUNTS_ONLY === "1") {
    console.log("accounts only: demo clients and orders skipped");
    return;
  }

  const existingClients = await db.select().from(clients);
  if (existingClients.length > 0) {
    console.log("clients already seeded, skipping demo data");
    return;
  }

  const demoClients = [
    { name: "საქართველოს ბანკი", idCode: "204378869", contactName: "ფასილიტი მენეჯერი", phone: "032 2 444 444", sites: ["ფილიალი ვაკე, ჭავჭავაძის 37", "ფილიალი საბურთალო, პეკინის 12", "სათავო ოფისი, გაგარინის 29"] },
    { name: "Rooms Hotel Tbilisi", idCode: "404912345", contactName: "ტექნიკური დირექტორი", phone: "032 2 020 099", sites: ["სასტუმრო, კოსტავას 14"] },
    { name: "ევექსი კლინიკები", idCode: "205070208", contactName: "ინფრასტრუქტურის მენეჯერი", phone: "032 2 500 500", sites: ["კლინიკა ვაჟა-ფშაველას 40", "კლინიკა ლუბლიანას 21"] },
    { name: "თეგეტა მოტორსი", idCode: "202177205", contactName: "შესყიდვები", phone: "032 2 601 601", sites: ["ცენტრი, აღმაშენებლის ხეივანი 12კმ"] },
    { name: "m2 დეველოპმენტი", idCode: "205280645", contactName: "პროექტ-მენეჯერი", phone: "032 2 474 747", sites: ["m2 ხილიანი, ბუდაპეშტის 3", "m2 ყაზბეგზე, ყაზბეგის 15"] },
  ];

  const siteIds: Record<string, { clientId: number; siteId: number; address: string }[]> = {};
  for (const c of demoClients) {
    const [row] = await db.insert(clients).values({ name: c.name, idCode: c.idCode, contactName: c.contactName, phone: c.phone }).returning();
    siteIds[c.name] = [];
    for (const s of c.sites) {
      const [site] = await db.insert(sites).values({ clientId: row.id, name: s.split(",")[0], address: s }).returning();
      siteIds[c.name].push({ clientId: row.id, siteId: site.id, address: s });
    }
  }

  const today = new Date();
  const d = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

  type DemoOrder = {
    title: string; client: string; siteIdx: number; type: "service" | "project"; status: "new" | "assigned" | "in_progress" | "done" | "closed";
    priority: "low" | "normal" | "high" | "urgent"; due: number; amount?: number; payment?: "unpaid" | "partial" | "paid"; assignees: number[]; createdDaysAgo: number;
  };
  const demo: DemoOrder[] = [
    { title: "CCTV კამერა არ მუშაობს, მე-3 სართული", client: "საქართველოს ბანკი", siteIdx: 0, type: "service", status: "in_progress", priority: "high", due: 1, amount: 450, payment: "unpaid", assignees: [0], createdDaysAgo: 2 },
    { title: "სახანძრო სიგნალიზაციის ყოველთვიური შემოწმება", client: "ევექსი კლინიკები", siteIdx: 0, type: "service", status: "assigned", priority: "normal", due: 3, amount: 800, payment: "unpaid", assignees: [1], createdDaysAgo: 1 },
    { title: "ახალი ფილიალის ელექტრომონტაჟი", client: "საქართველოს ბანკი", siteIdx: 1, type: "project", status: "in_progress", priority: "normal", due: 20, amount: 48500, payment: "partial", assignees: [0, 2], createdDaysAgo: 12 },
    { title: "WiFi ქსელის გაფართოება კონფერენც-დარბაზში", client: "Rooms Hotel Tbilisi", siteIdx: 0, type: "project", status: "assigned", priority: "normal", due: 10, amount: 12300, payment: "unpaid", assignees: [2], createdDaysAgo: 4 },
    { title: "წვდომის კონტროლის ბარათების წამკითხველი გაფუჭდა", client: "თეგეტა მოტორსი", siteIdx: 0, type: "service", status: "new", priority: "urgent", due: 0, amount: 350, payment: "unpaid", assignees: [], createdDaysAgo: 0 },
    { title: "სტრუქტურული კაბელირება, სართული 4-6", client: "m2 დეველოპმენტი", siteIdx: 0, type: "project", status: "done", priority: "normal", due: -2, amount: 27800, payment: "paid", assignees: [1, 2], createdDaysAgo: 25 },
    { title: "საგანგებო განათების ბატარეების შეცვლა", client: "ევექსი კლინიკები", siteIdx: 1, type: "service", status: "closed", priority: "low", due: -6, amount: 620, payment: "paid", assignees: [0], createdDaysAgo: 14 },
    { title: "სერვერული ოთახის კონდიცირების ავტომატიკა", client: "საქართველოს ბანკი", siteIdx: 2, type: "project", status: "new", priority: "high", due: 15, amount: 9600, payment: "unpaid", assignees: [], createdDaysAgo: 1 },
    { title: "CCTV ჩამწერის დისკის შეცვლა", client: "Rooms Hotel Tbilisi", siteIdx: 0, type: "service", status: "assigned", priority: "normal", due: -1, amount: 900, payment: "unpaid", assignees: [1], createdDaysAgo: 5 },
    { title: "BMS სისტემის კონფიგურაცია, ბლოკი B", client: "m2 დეველოპმენტი", siteIdx: 1, type: "project", status: "in_progress", priority: "normal", due: 30, amount: 34000, payment: "partial", assignees: [2], createdDaysAgo: 8 },
    { title: "ელექტრო ფარის შემოწმება და დაცვის ავტომატების შეცვლა", client: "თეგეტა მოტორსი", siteIdx: 0, type: "service", status: "done", priority: "normal", due: -3, amount: 1150, payment: "unpaid", assignees: [0], createdDaysAgo: 7 },
    { title: "ოპტიკური მაგისტრალის დაზიანება, სასწრაფო", client: "ევექსი კლინიკები", siteIdx: 0, type: "service", status: "in_progress", priority: "urgent", due: 0, amount: 2400, payment: "unpaid", assignees: [1, 0], createdDaysAgo: 0 },
  ];

  for (const o of demo) {
    const site = siteIds[o.client][o.siteIdx];
    const createdAt = new Date(today);
    createdAt.setDate(createdAt.getDate() - o.createdDaysAgo);
    const [row] = await db
      .insert(orders)
      .values({
        title: o.title,
        description: "დემო შეკვეთა. " + o.title,
        type: o.type,
        status: o.status,
        priority: o.priority,
        clientId: site.clientId,
        siteId: site.siteId,
        address: site.address,
        dueDate: d(o.due),
        amount: o.amount?.toFixed(2),
        paymentStatus: o.payment ?? "unpaid",
        createdBy: manager.id,
        createdAt,
        updatedAt: createdAt,
        completedAt: o.status === "done" || o.status === "closed" ? createdAt : null,
        closedAt: o.status === "closed" ? createdAt : null,
      })
      .returning();
    await db.insert(orderEvents).values({ orderId: row.id, userId: manager.id, type: "created", createdAt });
    for (const idx of o.assignees) {
      const ex = pick(executors, idx);
      await db.insert(orderAssignees).values({ orderId: row.id, userId: ex.id, assignedBy: manager.id, assignedAt: createdAt });
      await db.insert(orderEvents).values({ orderId: row.id, userId: manager.id, type: "assigned", data: { userId: ex.id, name: ex.name }, createdAt });
    }
    if (o.status === "in_progress") {
      await db.insert(orderComments).values({ orderId: row.id, userId: pick(executors, o.assignees[0] ?? 0).id, body: "ობიექტზე ვართ, დავიწყეთ სამუშაო.", createdAt: new Date() });
    }
  }

  // Two untriaged email orders for the inbox
  const inbox = [
    { from: "facilities@bog.ge", subject: "მოთხოვნა: კამერების შემოწმება ვაკის ფილიალში", body: "გამარჯობა,\n\nგთხოვთ, ამ კვირაში შეამოწმოთ ვაკის ფილიალის სამივე გარე კამერა, ერთი ღამით არ იწერს.\n\nპატივისცემით,\nფასილიტი მენეჯმენტი" },
    { from: "it@stambahotel.com", subject: "Access control - new door", body: "Hi team,\n\nWe need one more access-controlled door on the 2nd floor staff corridor. Please send an engineer for a site visit.\n\nThanks" },
  ];
  for (const m of inbox) {
    const [row] = await db
      .insert(orders)
      .values({
        title: m.subject,
        description: m.body,
        source: "email",
        triaged: false,
        emailFrom: m.from,
        emailSubject: m.subject,
        emailMessageId: `seed-${Math.random().toString(36).slice(2)}`,
        emailReceivedAt: new Date(),
      })
      .returning();
    await db.insert(orderEvents).values({ orderId: row.id, type: "created_from_email", data: { from: m.from } });
  }

  console.log(`clients: ${demoClients.length}, orders: ${demo.length + inbox.length}, admin: ${admin.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

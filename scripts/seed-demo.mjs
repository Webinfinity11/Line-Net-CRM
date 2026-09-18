/**
 * A year of plausible history so the dashboard has something to draw.
 *   npm run db:demo          add it
 *   npm run db:demo -- clear remove every row it created
 * Demo clients are marked `[demo]` in their notes; nothing else is touched.
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

const MARK = "[demo]";
const clear = process.argv.includes("clear");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (text, params) => pool.query(text, params);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const int = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const iso = (d) => d.toISOString();
const dayIso = (d) => d.toISOString().slice(0, 10);

const CLIENTS = [
  { name: 'შპს "ლიდერ მარკეტი"', code: "405211884", contact: "ზურაბ ნოზაძე", phone: "577 41 22 08", sites: [["ვაკის ფილიალი", "ჭავჭავაძის გამზირი 49, თბილისი", "ნათია ბერიშვილი", "599 12 44 70"], ["საბურთალოს ფილიალი", "ყაზბეგის გამზირი 24, თბილისი", "გიორგი წიკლაური", "599 12 44 71"], ["გლდანის ფილიალი", "ხიზანიშვილის ქუჩა 8, თბილისი", "ლელა ქავთარაძე", "599 12 44 72"]], systems: ["cctv", "fire", "access"] },
  { name: 'შპს "მედლაინ კლინიკა"', code: "404977321", contact: "ეკა მაღრაძე", phone: "577 90 11 33", sites: [["ცენტრალური კლინიკა", "ცინცაძის ქუჩა 16, თბილისი", "დავით კვარაცხელია", "599 33 08 12"], ["დიაგნოსტიკის ცენტრი", "პეკინის გამზირი 5, თბილისი", null, null]], systems: ["fire", "network", "access"] },
  { name: 'შპს "ბიზნეს ცენტრი ვერე"', code: "406128790", contact: "ირაკლი ჟორჟოლიანი", phone: "595 70 60 50", sites: [["ბიზნეს ცენტრი", "კოსტავას ქუჩა 71, თბილისი", "მარიამ თოდუა", "595 70 60 51"]], systems: ["network", "access", "electrical", "automation"] },
  { name: 'შპს "თბილისი ლოჯისტიკა"', code: "405330912", contact: "ლევან ღონღაძე", phone: "593 18 77 42", sites: [["საწყობი ლილო", "ქახეთის გზატკეცილი 12 კმ, თბილისი", "ბექა სულაძე", "593 18 77 43"], ["სატვირთო ტერმინალი", "ორხევის ქუჩა 3, თბილისი", null, null]], systems: ["cctv", "fire", "cable_trays"] },
  { name: 'შპს "კასპი ჰოტელს"', code: "412655104", contact: "ნინო ჩიქოვანი", phone: "598 44 21 19", sites: [["სასტუმრო", "ლესელიძის ქუჩა 20, თბილისი", "თამარ გელაშვილი", "598 44 21 20"]], systems: ["cctv", "fire", "network", "lighting"] },
  { name: 'შპს "სკოლა ნიუტონი"', code: "404812337", contact: "გიორგი ხუციშვილი", phone: "574 25 90 61", sites: [["სასწავლო კორპუსი", "დიღმის მასივი, IV კვარტალი, თბილისი", "ანა მეტრეველი", "574 25 90 62"]], systems: ["fire", "access", "network"] },
];

/** Real Tbilisi coordinates, so the demo map is not empty. */
const COORDS = {
  "ჭავჭავაძის გამზირი 49, თბილისი": [41.7093, 44.7546],
  "ყაზბეგის გამზირი 24, თბილისი": [41.7223, 44.7602],
  "ხიზანიშვილის ქუჩა 8, თბილისი": [41.7965, 44.8073],
  "ცინცაძის ქუჩა 16, თბილისი": [41.7112, 44.7815],
  "პეკინის გამზირი 5, თბილისი": [41.7248, 44.758],
  "კოსტავას ქუჩა 71, თბილისი": [41.7203, 44.7768],
  "ქახეთის გზატკეცილი 12 კმ, თბილისი": [41.7, 44.95],
  "ორხევის ქუჩა 3, თბილისი": [41.652, 44.862],
  "ლესელიძის ქუჩა 20, თბილისი": [41.692, 44.807],
  "დიღმის მასივი, IV კვარტალი, თბილისი": [41.783, 44.746],
};

const TITLES = {
  cctv: ["კამერების მონტაჟი", "ჩამწერის შეცვლა და კონფიგურაცია", "სისტემის დიაგნოსტიკა", "დისტანციური წვდომის აღდგენა", "კამერების გადანაწილება"],
  fire: ["სახანძრო სისტემის ყოველთვიური შემოწმება", "დეტექტორების შეცვლა", "სახანძრო პანელის პროგრამირება", "სიგნალიზაციის გაფართოება", "ცრუ განგაშის მიზეზის დადგენა"],
  access: ["კარის კონტროლერის მონტაჟი", "ბარათების პროგრამირება", "დომოფონის შეკეთება", "ელექტრომაგნიტური საკეტის შეცვლა"],
  network: ["ქსელის წერტილების გაყვანა", "როუტერის კონფიგურაცია", "WiFi წერტილების მონტაჟი", "სერვერული კარადის მოწყობა"],
  electrical: ["ელექტროგაყვანილობის შემოწმება", "განათების ხაზის გაყვანა", "ავტომატების შეცვლა"],
  lighting: ["განათების მონტაჟი", "სათადარიგო განათების ტესტი"],
  cable_trays: ["კაბელტრასის მოწყობა", "კაბელების გადაწყობა"],
  automation: ["BMS კონტროლერის კონფიგურაცია", "ავტომატიზაციის სცენარების დაყენება"],
};

async function wipe() {
  const { rows } = await q(`select id from clients where notes like $1`, [`%${MARK}%`]);
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return console.log("დემო მონაცემები არ მოიძებნა.");
  await q(`delete from orders where client_id = any($1)`, [ids]);
  await q(`delete from quotes where client_id = any($1)`, [ids]);
  await q(`delete from service_schedules where client_id = any($1)`, [ids]);
  await q(`delete from clients where id = any($1)`, [ids]);
  console.log(`წაიშალა ${ids.length} დემო კლიენტი და მათი შეკვეთები.`);
}

async function seed() {
  const [{ rows: execs }, { rows: staff }, { rows: services }] = await Promise.all([
    q(`select id from "user" where role = 'executor' order by name`),
    q(`select id from "user" where role in ('admin','manager') order by role`),
    q(`select id, name, unit, price, system_type from services where active`),
  ]);
  if (execs.length === 0 || services.length === 0) throw new Error("ჯერ გაუშვით db:seed და db:seed-services");
  const manager = staff[staff.length - 1]?.id ?? staff[0].id;

  // clients and their sites
  const clients = [];
  for (const c of CLIENTS) {
    const { rows } = await q(
      `insert into clients (name, id_code, contact_name, phone, notes) values ($1,$2,$3,$4,$5) returning id`,
      [c.name, c.code, c.contact, c.phone, `${MARK} სადემონსტრაციო ჩანაწერი`],
    );
    const clientId = rows[0].id;
    const sites = [];
    for (const [name, address, contact, phone] of c.sites) {
      const [lat, lng] = COORDS[address] ?? [null, null];
      const { rows: sr } = await q(`insert into sites (client_id, name, address, contact_name, contact_phone, lat, lng) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [clientId, name, address, contact, phone, lat, lng]);
      sites.push(sr[0].id);
    }
    clients.push({ id: clientId, sites, systems: c.systems });
  }

  const now = new Date();
  let orders = 0;
  let payments = 0;

  for (let back = 11; back >= 0; back--) {
    // a little growth towards the present, with the current month still running
    const count = back === 0 ? int(3, 6) : Math.round(int(5, 9) * (1 + (11 - back) * 0.05));
    for (let i = 0; i < count; i++) {
      const client = pick(clients);
      const system = pick(client.systems);
      const title = pick(TITLES[system] ?? TITLES.cctv);
      const created = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, int(1, back === 0 ? Math.max(1, now.getUTCDate() - 1) : 28), int(8, 17), pick([0, 15, 30])));
      const scheduled = new Date(created.getTime() + int(0, 5) * 864e5);
      scheduled.setUTCHours(int(8, 16), pick([0, 30]), 0, 0);
      const done = back === 0 && Math.random() < 0.35 ? null : new Date(scheduled.getTime() + int(1, 6) * 36e5);
      const status = done ? (Math.random() < 0.85 ? "closed" : "done") : pick(["new", "assigned", "in_progress"]);

      const lines = [];
      const pool_ = services.filter((s) => !s.system_type || s.system_type === system);
      for (let k = 0; k < int(1, 3); k++) {
        const s = pick(pool_.length ? pool_ : services);
        lines.push({ ...s, qty: int(1, s.price < 60 ? 8 : 3) });
      }
      const amount = lines.reduce((sum, l) => sum + Number(l.price) * l.qty, 0);

      const { rows: or } = await q(
        `insert into orders (title, description, type, status, priority, system_type, client_id, site_id, address,
           due_date, scheduled_at, planned_minutes, amount, source, triaged, created_by, created_at, updated_at, completed_at, finished_at, verified_at, verified_by, completion_note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,(select address from sites where id = $8),$9,$10,$11,$12,'manual',true,$13,$14,$15,$16,$16,$17,$18,$19) returning id`,
        [
          title,
          null,
          Math.random() < 0.75 ? "service" : "project",
          status,
          Math.random() < 0.12 ? "high" : "normal",
          system,
          client.id,
          pick(client.sites),
          dayIso(new Date(scheduled.getTime() + int(0, 3) * 864e5)),
          iso(scheduled),
          pick([60, 90, 120, 180, 240]),
          amount.toFixed(2),
          manager,
          iso(created),
          iso(done ?? created),
          done ? iso(done) : null,
          status === "closed" ? iso(new Date(done.getTime() + 36e5)) : null,
          status === "closed" ? manager : null,
          done ? "სამუშაო შესრულებულია, სისტემა გატესტილია და ჩაბარებულია." : null,
        ],
      );
      const orderId = or[0].id;
      orders++;

      for (const l of lines) {
        await q(`insert into order_items (order_id, service_id, name, unit, quantity, unit_price, created_by, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [orderId, l.id, l.name, l.unit, l.qty, l.price, manager, iso(created)]);
      }
      for (const u of [...execs].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.25 ? 2 : 1)) {
        await q(`insert into order_assignees (order_id, user_id, assigned_by, seen_at) values ($1,$2,$3,$4)`, [orderId, u.id, manager, iso(scheduled)]);
      }

      // money: most invoices are settled, a few age on purpose so the buckets fill
      if (done) {
        const roll = Math.random();
        // a real ledger clears with age: only the recent months still carry a balance
        const openChance = back > 3 ? 0.04 : back > 1 ? 0.18 : 0.4;
        const share = roll < openChance ? 0 : roll < openChance + 0.12 ? 0.5 : 1;
        if (share > 0) {
          const paidAt = new Date(done.getTime() + int(1, back <= 1 ? 8 : 40) * 864e5);
          if (paidAt < now) {
            const value = (amount * share).toFixed(2);
            await q(`insert into order_payments (order_id, amount, paid_at, method, created_by, created_at) values ($1,$2,$3,$4,$5,$3)`, [orderId, value, iso(paidAt), pick(["transfer", "transfer", "cash", "card"]), manager]);
            await q(`update orders set paid_total = $2, payment_status = $3::payment_status, paid_at = $4 where id = $1`, [orderId, value, share === 1 ? "paid" : "partial", share === 1 ? iso(paidAt) : null]);
            payments++;
          }
        }
      }
    }
  }

  // today's board, so the schedule and the day strip are not empty
  const todayPlan = [
    [9, 0, "in_progress", "cctv"],
    [10, 30, "assigned", "fire"],
    [12, 0, "assigned", "access"],
    [14, 0, "done", "network"],
    [16, 0, "assigned", "cctv"],
  ];
  for (let i = 0; i < todayPlan.length; i++) {
    const [h, m, status, system] = todayPlan[i];
    const client = pick(clients.filter((c) => c.systems.includes(system))) ?? pick(clients);
    const at = new Date(now);
    at.setUTCHours(h - 4, m, 0, 0); // Tbilisi is UTC+4
    const s2 = pick(services.filter((x) => x.system_type === system)) ?? pick(services);
    const qty = int(1, 3);
    const amount = Number(s2.price) * qty;
    const { rows: or } = await q(
      `insert into orders (title, type, status, priority, system_type, client_id, site_id, address, due_date, scheduled_at, planned_minutes,
         amount, source, triaged, created_by, created_at, updated_at, completed_at, completion_note)
       values ($1,'service',$2,$3,$4,$5,$6,(select address from sites where id = $6),$7,$8,120,$9,'manual',true,$10,$11,$11,$12,$13) returning id`,
      [
        pick(TITLES[system] ?? TITLES.cctv),
        status,
        i === 1 ? "high" : "normal",
        system,
        client.id,
        pick(client.sites),
        dayIso(now),
        iso(at),
        amount.toFixed(2),
        manager,
        iso(new Date(at.getTime() - int(1, 4) * 864e5)),
        status === "done" ? iso(new Date(at.getTime() + 2 * 36e5)) : null,
        status === "done" ? "სამუშაო შესრულებულია, კლიენტს ჩავაბარეთ." : null,
      ],
    );
    await q(`insert into order_items (order_id, service_id, name, unit, quantity, unit_price, created_by) values ($1,$2,$3,$4,$5,$6,$7)`, [or[0].id, s2.id, s2.name, s2.unit, qty, s2.price, manager]);
    await q(`insert into order_assignees (order_id, user_id, assigned_by, seen_at) values ($1,$2,$3,$4)`, [or[0].id, execs[i % execs.length].id, manager, iso(at)]);
    orders++;
  }

  // quotes across the last three months, in every state
  const QUOTES = [
    ["სახანძრო სიგნალიზაციის მოწყობა ახალ ფილიალში", "fire", "accepted"],
    ["ვიდეოკონტროლის სისტემა საწყობისთვის", "cctv", "accepted"],
    ["წვდომის კონტროლი ოფისის სართულზე", "access", "sent"],
    ["სტრუქტურული კაბელირება 40 სამუშაო ადგილზე", "structured_cabling", "sent"],
    ["განათების მოდერნიზაცია", "lighting", "declined"],
    ["BMS ავტომატიზაციის პროექტი", "automation", "draft"],
    ["კამერების გაფართოება პარკინგზე", "cctv", "accepted"],
    ["სახანძრო სისტემის ყოველწლიური მომსახურება", "fire", "sent"],
  ];
  for (const [title, system, status] of QUOTES) {
    const client = pick(clients);
    const created = new Date(now.getTime() - int(3, 85) * 864e5);
    const lines = [];
    const pool_ = services.filter((s) => !s.system_type || s.system_type === system);
    for (let k = 0; k < int(2, 4); k++) {
      const s = pick(pool_.length ? pool_ : services);
      lines.push({ ...s, qty: int(2, 12) });
    }
    const total = lines.reduce((sum, l) => sum + Number(l.price) * l.qty, 0);
    const { rows: qr } = await q(
      `insert into quotes (title, status, client_id, site_id, system_type, valid_until, vat_percent, total, created_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) returning id`,
      [title, status, client.id, pick(client.sites), system, dayIso(new Date(created.getTime() + 30 * 864e5)), "18.00", total.toFixed(2), manager, iso(created)],
    );
    for (const l of lines) {
      await q(`insert into quote_items (quote_id, service_id, name, unit, quantity, unit_price, created_at) values ($1,$2,$3,$4,$5,$6,$7)`, [qr[0].id, l.id, l.name, l.unit, l.qty, l.price, iso(created)]);
    }
  }

  // two maintenance contracts, so the schedule page is not empty either
  for (const c of clients.slice(0, 2)) {
    await q(
      `insert into service_schedules (title, client_id, site_id, system_type, frequency, next_date, lead_days, amount, assignee_ids, active)
       values ($1,$2,$3,'fire','monthly',$4,7,$5,$6,true)`,
      ["სახანძრო სისტემის ყოველთვიური შემოწმება", c.id, c.sites[0], dayIso(new Date(now.getTime() + int(3, 20) * 864e5)), "150.00", [pick(execs).id]],
    );
  }

  console.log(`დაემატა: ${clients.length} კლიენტი, ${orders} შეკვეთა, ${payments} გადახდა, ${QUOTES.length} შეთავაზება, 2 გრაფიკი.`);
}

try {
  await wipe();
  if (!clear) await seed();
} finally {
  await pool.end();
}

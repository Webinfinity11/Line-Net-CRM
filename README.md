# Line Net CRM

შეკვეთების მართვის სისტემა შპს ლაინნეტისთვის. სპეციფიკაცია: `docs/02-mvp-spec.md`.

**ნაკადი:** შეკვეთა შემოდის ელფოსტით (ან იქმნება ხელით) → მენეჯერი ავსებს კლიენტს/ობიექტს და ანიშნებს შემსრულებელს → შემსრულებელი ასრულებს და სტატუსს ცვლის → ადმინი და მენეჯერი დაფაზე ხედავენ სურათს.

## სტეკი

Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL + Drizzle ORM · Better Auth (ელფოსტა+პაროლი, Microsoft SSO) · Tailwind 4 + shadcn/ui · Recharts.

## გაშვება ლოკალურად

```bash
createdb linenet_crm
cp .env.example .env.local        # შეავსეთ DATABASE_URL, BETTER_AUTH_SECRET
npm install
npm run db:push                   # ცხრილების შექმნა
npm run db:seed                   # დემო მომხმარებლები და შეკვეთები
npm run dev                       # http://localhost:3000
```

დემო ანგარიშები (პაროლი `linenet123`):

| როლი | ელფოსტა |
|---|---|
| ადმინი | admin@line-net.ge |
| მენეჯერი | manager@line-net.ge |
| შემსრულებელი | giorgi@line-net.ge, levan@line-net.ge, dato@line-net.ge |

## სტრუქტურა

```
app/(app)/            ავტორიზებული გვერდები: დაფა, orders, inbox, my, clients, settings/users
app/login/            შესვლა
app/api/auth/         Better Auth
app/api/inbound-email POST webhook წერილებისთვის
app/api/cron/poll-mail  Graph ყუთის შემოწმება (cron)
app/api/files/[id]    დანართების ჩამოტვირთვა (ავტორიზაციით)
actions/              server actions: orders, clients, users, mail
lib/orders.ts         მოთხოვნები (სია, ბარათი, დაფის სტატისტიკა)
lib/auth.ts           Better Auth კონფიგურაცია
lib/i18n.ts           ქართული ტექსტები, სტატუსების ფერები
lib/inbound-email.ts  წერილი → შეკვეთა
lib/graph-mail.ts     Microsoft Graph ყუთის წაკითხვა
db/schema.ts          Drizzle სქემა
db/seed.ts            დემო მონაცემები
components/app/       UI კომპონენტები
docs/                 კვლევა, სპეციფიკაცია, M365 ინსტრუქცია
```

## როლები

| როლი | უფლებები |
|---|---|
| admin | ყველაფერი + მომხმარებლების მართვა + წაშლა |
| manager | შეკვეთები, კლიენტები, შემოსულები, დაფა, თანხები |
| executor | მხოლოდ თავისი შეკვეთები: სტატუსი „დაწყება/შესრულებულია“, კომენტარი, ფაილის ატვირთვა. თანხებს ვერ ხედავს |

## შეკვეთის სტატუსები

`new` ახალი → `assigned` დანიშნული → `in_progress` მიმდინარე → `done` შესრულებული → `closed` დახურული. დამატებით `cancelled` გაუქმებული.
შემსრულებლის დანიშვნისას „ახალი“ ავტომატურად ხდება „დანიშნული“.

## ელფოსტის ინტეგრაცია

იხ. `docs/03-microsoft-365-setup.md`. ორი გზა: Microsoft Graph polling (`/api/cron/poll-mail`) ან webhook (`/api/inbound-email`).

## დეპლოი (Railway)

1. Postgres სერვისი → `DATABASE_URL`.
2. App სერვისი ამ რეპოდან, build `npm run build`, start `npm start`. გარემოს ცვლადები `.env.example`-ის მიხედვით. `BETTER_AUTH_URL` = საიტის სრული მისამართი.
3. Volume დამაგრებული `/data`-ზე და `UPLOAD_DIR=/data/uploads` დანართებისთვის.
4. Cron სერვისი (ან Railway cron schedule), რომელიც ყოველ 5 წუთში იძახებს `GET /api/cron/poll-mail` `Authorization: Bearer $INBOUND_EMAIL_SECRET` header-ით.
5. პირველი გაშვების შემდეგ: `npm run db:push` და ადმინის შექმნა `npm run db:seed`-ით (SEED_PASSWORD შეცვალეთ), ან პირდაპირ ბაზაში.

## სკრიპტები

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run db:push` · `npm run db:seed` · `npm run db:studio`

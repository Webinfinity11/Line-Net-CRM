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
npm run db:migrate                # ცხრილების შექმნა / მიგრაციები
npm run db:seed                   # დემო მომხმარებლები და შეკვეთები
npm run dev                       # http://localhost:3000
```

დემო ანგარიშები:

| როლი | ელფოსტა | პაროლი |
|---|---|---|
| ადმინი | admin@line-net.ge | admin1234 |
| მენეჯერი | manager@line-net.ge | meneger1234 |
| შემსრულებელი | giorgi@line-net.ge, levan@line-net.ge, dato@line-net.ge | user1234 |

## ფუნქციები (ეტაპი 1.5)

- შეკვეთაზე: სისტემა (სახანძრო, CCTV, ელექტრო...), დაგეგმილი დრო, გარანტია, ობიექტზე დრო („მივედი/დავასრულე“), მასალები ხარჯით და მოგებით, ჩეკ-ლისტი შაბლონებით, სამუშაო ფურცელი PDF (`/orders/[id]/sheet`)
- განრიგი დღის მიხედვით შემსრულებლებზე (`/schedule`)
- პერიოდული ტექმომსახურება: გრაფიკები, ავტომატური შეკვეთები (`/maintenance`, cron `/api/cron/schedules` ან შიდა scheduler)
- ობიექტზე აღჭურვილობის რეესტრი და კოორდინატები, რუკა დაფაზე და ბარათებზე (Leaflet + OpenStreetMap, Nominatim გეოკოდინგი)
- შეტყობინებები სისტემაში და ელფოსტით (SMTP), პროფილი და პაროლის შეცვლა
- ანგარიშები: კლიენტების, შემსრულებლების, სისტემების მიხედვით, თვის ფინანსური; Excel ექსპორტი (`/api/export`) და კლიენტების იმპორტი Excel-დან
- შემსრულებლის სპეციალიზაცია სისტემების მიხედვით

## შიდა scheduler

`instrumentation.ts` სერვერის გაშვებისას რთავს ტაიმერს: ყუთის შემოწმება 5 წუთში ერთხელ (დაკავშირებული Outlook ან GRAPH_* კონფიგურაცია) და გრაფიკული შეკვეთების გენერაცია დღეში ერთხელ. გამორთვა: `INTERNAL_CRON=0`, მაშინ გარე cron-მა უნდა გამოიძახოს `/api/cron/poll-mail` და `/api/cron/schedules`.

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

- **უფასო პირადი Outlook.com / Hotmail:** [დაკავშირების ინსტრუქცია](docs/06-outlook-personal-setup.md). ადმინისტრატორი „შემოსულებიდან“ აძლევს წერილების წაკითხვის ნებართვას; ტოკენები სერვერზე დაშიფრულად ინახება.
- **ორგანიზაციის Microsoft 365:** [არსებული ინსტრუქცია](docs/03-microsoft-365-setup.md), `GRAPH_*` პარამეტრები.
- ალტერნატიული webhook: `/api/inbound-email`.

Microsoft-ის აპლიკაციის რეგისტრაცია ცალკე საჭიროა. კოდის დაყენება თავისთავად ფოსტას არ აკავშირებს.

## Vercel-ზე განთავსების წინაპირობები

Vercel Hobby განკუთვნილია პირადი, არაკომერციული გამოყენებისთვის. კომპანიის CRM-ისთვის შეამოწმეთ შესაბამისი გეგმა; ფასიანი გეგმა ავტომატურად არ აქტიურდება ამ რეპოზიტორიიდან.

სრულად სამუშაო განთავსებამდე საჭიროა გარე PostgreSQL ბაზა, დანართების მუდმივი საცავი და serverless გარემოზე მორგებული scheduler (`INTERNAL_CRON=0`). ლოკალური `DATABASE_URL` და `uploads/` Vercel-ზე ვერ გადაიტანება როგორც მოქმედი სერვისები. გასაღებები და ბაზის პაროლი დაამატეთ მხოლოდ ჰოსტინგის დაცულ პარამეტრებში. საჯაროდ ხელმისაწვდომ გარემოში არ გამოიყენოთ ზემოთ მითითებული დემო პაროლები.

## დეპლოი (Railway)

1. Postgres სერვისი → `DATABASE_URL`.
2. App სერვისი ამ რეპოდან, build `npm run build`, start `npm start`. გარემოს ცვლადები `.env.example`-ის მიხედვით. `BETTER_AUTH_URL` = საიტის სრული მისამართი.
3. Volume დამაგრებული `/data`-ზე და `UPLOAD_DIR=/data/uploads` დანართებისთვის.
4. Cron არ არის საჭირო: შიდა scheduler მუშაობს. სურვილისამებრ `INTERNAL_CRON=0` და გარე cron `/api/cron/*` endpoint-ებზე.
5. პირველი გაშვების შემდეგ: `npm run db:push` და ადმინის შექმნა `npm run db:seed`-ით (SEED_PASSWORD შეცვალეთ), ან პირდაპირ ბაზაში.

## გამართვის ეტაპი
იხ. `docs/05-improvement-pass.md`: გადახდების ისტორია, ვიზიტები, ჩაბარების კონტროლი, განრიგის გადაფარვა, ჩეკ-ლისტების შაბლონები, მიგრაციები.

## სკრიპტები

`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run db:generate` · `npm run db:migrate` · `npm run db:seed` · `npm run db:studio`

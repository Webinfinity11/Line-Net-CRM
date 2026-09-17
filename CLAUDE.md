@AGENTS.md

# Line Net CRM

Order-dispatch CRM for შპს ლაინნეტი (electrical / low-current contractor, Tbilisi). Georgian UI only.
Spec: `docs/02-mvp-spec.md` (MVP) + `docs/04-phase-1.5-spec.md` (agreed additions, all implemented except Microsoft integration which waits on Azure credentials). Do not add features beyond these unasked.

## Commands
- `npm run dev` (http://localhost:3000), `npm run typecheck`, `npm run build`
- Schema changes: edit `db/schema.ts`, then `npx drizzle-kit generate --name <slug>` and `npm run db:migrate` (versioned SQL in `db/migrations`). `db:push` is only for throwaway local databases; `npm run db:seed` creates demo users (admin1234 / meneger1234 / user1234), checklist templates and demo orders; safe to re-run
- Env lives in `.env.local` (see `.env.example`)

## Architecture
- Next.js 16 App Router. Route params and searchParams are Promises; use `PageProps<"/path">` and `await`.
- `proxy.ts` (not middleware) redirects unauthenticated requests to `/login` by cookie presence only; real auth checks happen in `lib/session.ts` (`requireUser(roles)`).
- Auth: Better Auth + drizzle adapter + admin plugin. Roles: `admin | manager | executor` stored on `user.role`. Microsoft SSO enabled only when `MICROSOFT_*` env set.
- Data: Drizzle ORM, schema in `db/schema.ts`. Anything importing `@/db` or `@/lib/orders` is server-only. Pure helpers shared with client components live in `lib/order-utils.ts`.
- Mutations are server actions in `actions/*.ts`; they return `ActionResult` (`{ok:true}` / `{ok:false,error}`) and call `revalidatePath`. Authorization is enforced inside every action.
- UI: Tailwind 4 + shadcn (base-nova style on `@base-ui/react`). Triggers use `render={<Button/>}` instead of `asChild`. Selects in forms use `NativeSelect`.
- All user-facing strings and status/priority/payment labels and colors are in `lib/i18n.ts`.

## Domain rules
- Order statuses: new → assigned → in_progress → done → closed, plus cancelled. Assigning executors to a `new` order sets `assigned`; removing all sets `new`.
- Executors see only orders assigned to them, cannot see amounts, can only move assigned→in_progress→done (and done→in_progress), comment, upload files.
- Orders created from email have `source='email'`, `triaged=false` and appear in `/inbox` until a manager saves them via the edit form (sets `triaged=true`) or cancels them.
- Inbound mail: `POST /api/inbound-email` (Bearer `INBOUND_EMAIL_SECRET`) or Graph polling `GET /api/cron/poll-mail`; both call `lib/inbound-email.ts` which dedupes on `email_message_id`.
- Attachments are stored on disk under `UPLOAD_DIR` and served through `/api/files/[id]` after an auth check.
- Maintenance schedules (`service_schedules`) generate orders via `lib/schedules.ts` (idempotent per schedule + due date); triggered by `instrumentation.ts` daily, `/api/cron/schedules`, or the "გენერაცია ახლა" button.
- Systems: `system_type` stays the stable enum key on orders/services/schedules, while the `systems` table owns the label, order and visibility. Admins edit it at `/settings/systems`; server code reads `lib/systems.ts`, client components read `SystemsProvider` (mounted in the app layout). Adding a brand new system still needs a migration that extends the enum.
- Services: `services` is the price catalogue (admin screen at `/settings/services`); `order_items` are the billable lines on an order and drive `orders.amount` through `lib/order-items.ts`. Lines keep their own name/unit/price, so editing the catalogue never rewrites past orders. Executors never receive them.
- Checklists were removed from the product (Sept 2026). The `checklist_templates` and `order_checklist_items` tables still exist with their data but nothing reads them; `completeOrder` now gates only on the photo requirement.
- Notifications: `lib/notify.ts` `notifyUsers()` writes rows and emails via SMTP when configured. Hook points: assignment, executor marks done, inbound email, schedule generation.
- Maps: `components/app/map-view.tsx` wraps Leaflet (client-only, dynamic import). Sites carry `lat/lng`; `lib/geocode.ts` uses Nominatim best-effort on site save.
- Excel: `/api/export?type=...` (SheetJS) and `actions/import.ts` for client import. Reports queries in `lib/reports.ts`.
- Times: all "today"/day boundaries use Asia/Tbilisi explicitly (`lib/schedule-utils.ts`).
- Finance: `order_payments` is the source of truth; `orders.paid_total`/`payment_status` are recomputed by `lib/payments.ts` inside the same transaction. Never set payment_status by hand. Executors get orders only through `getOrderForUser`/`listMyOrders`, which strip money fields on the server.
- Work flow: visits (`order_visits`, one open per executor+order) are separate from completion. `completeOrder` needs a note and is gated server-side by required checklist items and `requires_photo`. `done` → staff `closed` (verified). Closed orders are frozen except for admins.
- Never export helpers from `actions/*.ts` ("use server" makes every export a public endpoint); put shared logic in `lib/*` with `server-only`.
- Tests: `npm test` (vitest, pure logic in `tests/`).

## UI rendering rules
- The Tailwind scale is px-based (`--spacing: 4px`, px text sizes, px breakpoints in `app/globals.css`). Some embedded browser panels force a large root/minimum font size; px keeps spacing stable. Do not reintroduce rem-based tokens.
- `formatDate` / `formatMoney` in `lib/i18n.ts` are deterministic (manual formatting, Tbilisi timezone). Never use `toLocaleString`/`Intl` currency formatting in components: Node and browsers produce different output and React reports hydration mismatches.
- Maps: `components/app/map-view.tsx` uses CARTO Positron raster tiles (free, keyless, retina via `{r}`), numbered `divIcon` pins with popups, `fadeAnimation: false` and a ResizeObserver-driven `invalidateSize`. Attribution for OSM and CARTO is required and already set.

## Colour and type discipline
- One accent (#3457d5) for primary actions and active state. Status chips use the muted family in `STATUS_COLORS`. Red (#b13f32) only for problems (overdue, unpaid, urgent). Green (#25815a) only for money received or success. Everything else is neutral grey.
- Systems, order types and avatars in dense lists are neutral: a row must not carry more than two colours beyond its status chip. `SYSTEM_COLORS` is deliberately one neutral value for every system.
- Headings and buttons: FiraGO Bold (700), tight tracking, Georgian Mtavruli via `toMtavruli` (Button, CardTitle, DialogTitle, SheetTitle and dialog/menu triggers apply it automatically). Names, body text, table headers, form labels and aria/title attributes stay Mkhedruli.
- Cards are `.ln-card` (white, radius 20, soft shadow, no border) on a #f4f6fa page. Never nest a card in a card.

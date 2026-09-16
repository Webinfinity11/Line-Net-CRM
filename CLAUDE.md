@AGENTS.md

# Line Net CRM

Order-dispatch CRM for შპს ლაინნეტი (electrical / low-current contractor, Tbilisi). Georgian UI only.
Spec: `docs/02-mvp-spec.md`. Anything beyond it is phase 2, do not add unasked.

## Commands
- `npm run dev` (http://localhost:3000), `npm run typecheck`, `npm run build`
- `npm run db:push` applies `db/schema.ts` to Postgres; `npm run db:seed` creates demo users (password `linenet123`) and orders
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

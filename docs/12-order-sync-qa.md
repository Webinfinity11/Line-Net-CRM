# №1 — დავალებების ავტომატური სინქრონიზაცია

2026-09-28. Scope: request №1 only; awaiting the user's local review before №2.

## Change

The authenticated layout now subscribes to `/api/sync`. A permission-scoped PostgreSQL fingerprint detects creation, assignment/removal, workflow changes, visits, requests, checklist changes, and deletions. It includes row versions rather than relying solely on `updated_at` or notification creation. It works across separate application instances without schema changes.

The server checks every two seconds and sends changed revisions over SSE. The browser refreshes the Server Component tree, including shared navigation counters, while preserving client state, URL filters, and scroll. It reconnects on visibility/network restoration, rotates connections before serverless timeouts, and uses three-second short polling when streaming is unavailable. The first snapshot refreshes once to cover the render/subscription gap and cached navigation.

Only an opaque revision is transmitted. Session identity comes from authentication, with current database role/company/banned checks. There is no financial or order payload in this endpoint. This is near-real-time synchronization (normally about 2 seconds plus rendering/network time), not a database-triggered push service. Each visible tab samples its authorized records; larger deployments should measure query load before scaling.

## Verification

- `npm run typecheck`: passed.
- Existing unit suite: 261 passed.
- `npx vitest run tests/order-sync-route.test.ts`: 8 passed; authorization, heartbeat, changes, fallback, cancellation, database failures, in-flight abort cleanup.
- `npm run test:integration -- tests/integration/order-sync.test.ts`: 8 passed against disposable PostgreSQL; scope isolation, timestamp-independent changes, assignment removal, partial handover, deletion, stable revisions, bans/company reassignment.
- `scripts/qa-live-sync.mjs`: 10 Chrome checks passed using four independent authenticated contexts. Client creation, manager assignment, executor start, client/admin/manager updates, unsaved form preservation, external database changes, polling fallback, offline recovery, and no browser runtime errors. Observer pages did not perform document reloads. The script removes only its own created order.

The wider existing `team-flow` integration suite has 5 failures out of 26, reproduced when run alone. Its completion fixtures lack the photos now required by `completionProblems`. The new sync tests pass independently; the completion rule and existing fixtures were not changed in this task.

## Local review

Local server: `http://localhost:3000`, backed by the separate local `linenet_sync_qa` database. Production data/schema were not modified. Internal cron and outgoing client email are disabled for this server.

Visible Chrome review windows were opened and signed in as manager, executor, and client. Review order: **LN-00006 — №1 — ავტომატური განახლების შემოწმება**.

1. Executor: `/my?tab=new` → click **დაწყება** on the review order.
2. Manager: `/orders/6` → verify its status changes without Refresh.
3. Client: `/portal` → verify the same order shows **მიმდინარეობს**.
4. To test creation, use the client's **ახალი შეკვეთა** while the manager keeps `/inbox` open.
5. Manager processes and assigns the new request; the executor keeps `/my?tab=new` open and sees it arrive automatically.

The three browser windows use separate sessions. Demo emails are `manager@sync.local`, `executor@sync.local`, `client@sync.local`, and `admin@sync.local`; local demo password: `SyncTest2026!`.

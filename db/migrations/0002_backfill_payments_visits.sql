-- Data backfill after 0001.
-- 1) Checklist template items: string[] -> {label, required}[]
UPDATE "checklist_templates"
SET "items" = COALESCE((
  SELECT jsonb_agg(jsonb_build_object('label', x, 'required', false))
  FROM jsonb_array_elements_text("items") AS x
), '[]'::jsonb)
WHERE jsonb_typeof("items") = 'array'
  AND (jsonb_array_length("items") = 0 OR jsonb_typeof("items"->0) = 'string');
--> statement-breakpoint
-- 2) Orders already marked "paid": one migration payment equal to the order amount.
--    Rule: paid_at (or completed_at, or updated_at) is used as the payment date, method = 'migration'.
INSERT INTO "order_payments" ("order_id", "amount", "paid_at", "method", "note", "created_at")
SELECT o."id", o."amount", COALESCE(o."paid_at", o."completed_at", o."updated_at"), 'migration',
       'ავტომატურად გადატანილი: სტატუსი „გადახდილი“, თანხა = შეკვეთის თანხა', now()
FROM "orders" o
WHERE o."payment_status" = 'paid' AND o."amount" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "order_payments" p WHERE p."order_id" = o."id");
--> statement-breakpoint
UPDATE "orders" SET "paid_total" = "amount" WHERE "payment_status" = 'paid' AND "amount" IS NOT NULL;
--> statement-breakpoint
-- 3) Orders marked "partial": the received amount is unknown, flag for manual review (no payment invented).
UPDATE "orders" SET "payment_review_needed" = true WHERE "payment_status" = 'partial';
--> statement-breakpoint
-- 4) Legacy arrived/finished pairs become a visit only when the executor is unambiguous (exactly one assignee).
INSERT INTO "order_visits" ("order_id", "user_id", "started_at", "ended_at", "note", "created_at")
SELECT o."id", a."user_id", o."arrived_at", o."finished_at", 'ისტორიული ვიზიტი (გადატანილი ძველი ველებიდან)', now()
FROM "orders" o
JOIN "order_assignees" a ON a."order_id" = o."id"
WHERE o."arrived_at" IS NOT NULL
  AND (SELECT count(*) FROM "order_assignees" x WHERE x."order_id" = o."id") = 1
  AND NOT EXISTS (SELECT 1 FROM "order_visits" v WHERE v."order_id" = o."id");
--> statement-breakpoint
-- 5) Default settings
INSERT INTO "app_settings" ("key", "value") VALUES ('work_hours_per_day', '8'::jsonb) ON CONFLICT DO NOTHING;

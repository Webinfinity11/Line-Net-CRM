ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "manager_id" text REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "manager_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "order_assignees" ADD COLUMN IF NOT EXISTS "done_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "order_assignees" ADD COLUMN IF NOT EXISTS "done_note" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_requests" (
 "id" serial PRIMARY KEY, "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
 "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "requested_by" text REFERENCES "user"("id") ON DELETE SET NULL, "note" text,
 "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','approved','declined')),
 "decided_by" text REFERENCES "user"("id") ON DELETE SET NULL, "decided_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_requests_order_idx" ON "order_requests" ("order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_requests_pending_unique" ON "order_requests" ("order_id", "user_id") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_contacts" (
 "id" serial PRIMARY KEY, "site_id" integer NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE,
 "name" text NOT NULL, "position" text, "phone" text, "email" text,
 "receives_email" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_contacts_site_idx" ON "site_contacts" ("site_id");

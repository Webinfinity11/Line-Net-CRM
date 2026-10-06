CREATE TABLE IF NOT EXISTS "service_subgroups" (
 "id" serial PRIMARY KEY,
 "system_slug" text NOT NULL REFERENCES "systems"("slug") ON DELETE CASCADE,
 "name" text NOT NULL,
 "sort" integer NOT NULL DEFAULT 0,
 "active" boolean NOT NULL DEFAULT true,
 "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_subgroups_system_sort_idx" ON "service_subgroups" ("system_slug", "sort");
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "subgroup_id" integer REFERENCES "service_subgroups"("id") ON DELETE SET NULL;

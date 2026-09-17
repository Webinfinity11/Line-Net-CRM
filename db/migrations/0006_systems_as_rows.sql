-- Systems become editable rows instead of a fixed enum, the way field-service products do it:
-- a starter list an admin can extend, rename and deactivate. Keys stay the same strings,
-- so every existing order, service, schedule and equipment row keeps its system.

ALTER TABLE "systems" RENAME TO "systems_old";--> statement-breakpoint

CREATE TABLE "systems" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

INSERT INTO "systems" ("slug", "name", "color", "sort", "active", "updated_at")
SELECT "key"::text, "name", "color", "sort", "active", "updated_at" FROM "systems_old";--> statement-breakpoint

DROP TABLE "systems_old";--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "system_type" TYPE text USING "system_type"::text;--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "system_type" TYPE text USING "system_type"::text;--> statement-breakpoint
ALTER TABLE "service_schedules" ALTER COLUMN "system_type" TYPE text USING "system_type"::text;--> statement-breakpoint
ALTER TABLE "site_equipment" ALTER COLUMN "system_type" TYPE text USING "system_type"::text;--> statement-breakpoint
ALTER TABLE "checklist_templates" ALTER COLUMN "system_type" TYPE text USING "system_type"::text;--> statement-breakpoint

DROP TYPE IF EXISTS "system_type";--> statement-breakpoint

ALTER TABLE "orders" ADD CONSTRAINT "orders_system_slug_fk" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("slug") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_system_slug_fk" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("slug") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "site_equipment" ADD CONSTRAINT "site_equipment_system_slug_fk" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("slug") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

CREATE INDEX "systems_sort_idx2" ON "systems" USING btree ("sort");

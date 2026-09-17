CREATE TYPE "quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined');--> statement-breakpoint

CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text GENERATED ALWAYS AS ('QT-' || lpad(id::text, 5, '0')) STORED,
	"title" text NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"client_id" integer,
	"site_id" integer,
	"system_type" text,
	"note" text,
	"terms" text,
	"valid_until" date,
	"vat_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"order_id" integer,
	"sent_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"service_id" integer,
	"name" text NOT NULL,
	"unit" text DEFAULT 'ცალი' NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_system_fk" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("slug") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null;--> statement-breakpoint

CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_client_idx" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");

-- A client login belongs to one company and places that company's orders from the portal.
ALTER TYPE "public"."order_source" ADD VALUE IF NOT EXISTS 'portal';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "client_id" integer;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;

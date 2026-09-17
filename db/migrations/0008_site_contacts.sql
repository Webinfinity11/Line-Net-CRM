-- A branch has its own contact: the technician calls the site, not head office.
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "contact_name" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "contact_phone" text;

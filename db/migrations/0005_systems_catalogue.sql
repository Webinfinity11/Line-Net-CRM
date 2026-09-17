CREATE TABLE "systems" (
	"key" "system_type" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "systems_sort_idx" ON "systems" USING btree ("sort");--> statement-breakpoint
INSERT INTO "systems" ("key", "name", "sort") VALUES
  ('fire', 'ხანძარსაწინააღმდეგო', 10),
  ('cctv', 'CCTV', 20),
  ('access', 'წვდომის კონტროლი', 30),
  ('network', 'IT / ქსელი', 40),
  ('structured_cabling', 'სტრუქტურული კაბელირება', 50),
  ('electrical', 'ელექტრო', 60),
  ('lighting', 'განათება', 70),
  ('cable_trays', 'კაბელტრასები', 80),
  ('automation', 'ავტომატიზაცია (BMS)', 90),
  ('design', 'პროექტირება', 100),
  ('other', 'სხვა', 110)
ON CONFLICT ("key") DO NOTHING;

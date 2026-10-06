CREATE TABLE IF NOT EXISTS "executor_competencies" (
 "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "system_slug" text NOT NULL REFERENCES "systems"("slug") ON DELETE CASCADE,
 PRIMARY KEY ("user_id", "system_slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "executor_competencies_system_idx" ON "executor_competencies" ("system_slug");

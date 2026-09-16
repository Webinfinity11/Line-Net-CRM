CREATE TABLE "outlook_connection" (
	"id" text PRIMARY KEY DEFAULT 'shared' NOT NULL,
	"account_id" text NOT NULL,
	"mailbox" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_by" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outlook_connection" ADD CONSTRAINT "outlook_connection_connected_by_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
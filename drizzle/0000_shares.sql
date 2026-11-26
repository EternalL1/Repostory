CREATE TABLE "shares" (
	"slug" text PRIMARY KEY NOT NULL,
	"version" smallint NOT NULL,
	"payload" jsonb NOT NULL,
	"delete_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "shares_expires_at_idx" ON "shares" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shares_created_at_idx" ON "shares" USING btree ("created_at");
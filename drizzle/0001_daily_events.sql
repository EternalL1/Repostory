CREATE TABLE "daily_events" (
	"day" date NOT NULL,
	"event" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_events_day_event_pk" PRIMARY KEY("day","event")
);

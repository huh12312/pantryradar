CREATE TABLE IF NOT EXISTS "houses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "houses" ADD CONSTRAINT "houses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "houses" ("household_id", "name")
SELECT "id", 'Main House' FROM "households"
WHERE "id" NOT IN (SELECT "household_id" FROM "houses");
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "house_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "items" i
SET "house_id" = (
  SELECT h.id FROM "houses" h
  WHERE h.household_id = i.household_id
  ORDER BY h.created_at
  LIMIT 1
)
WHERE i.house_id IS NULL;

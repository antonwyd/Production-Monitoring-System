CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"process" text NOT NULL,
	"area" text NOT NULL,
	"ng_group_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "lost_time_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"lost_time_type_id" integer NOT NULL,
	"minutes" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lost_time_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "lost_time_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"mc_no" text NOT NULL,
	"line" text DEFAULT '' NOT NULL,
	"main_part" text DEFAULT '' NOT NULL,
	"can_switch_to" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text NOT NULL,
	"name" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "members_nik_unique" UNIQUE("nik")
);
--> statement-breakpoint
CREATE TABLE "ng_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"ng_group_id" integer NOT NULL,
	"code" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ng_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "ng_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"stki" double precision NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"part_id" integer NOT NULL,
	"machine_id" integer,
	"qty_normal" integer DEFAULT 0 NOT NULL,
	"min_normal" integer DEFAULT 0 NOT NULL,
	"qty_ot" integer DEFAULT 0 NOT NULL,
	"min_ot" integer DEFAULT 0 NOT NULL,
	"lot" text DEFAULT '' NOT NULL,
	"oiban" text DEFAULT '' NOT NULL,
	"ng1" integer DEFAULT 0 NOT NULL,
	"ng2" integer DEFAULT 0 NOT NULL,
	"ng3" integer DEFAULT 0 NOT NULL,
	"ng4" integer DEFAULT 0 NOT NULL,
	"ng5" integer DEFAULT 0 NOT NULL,
	"ng6" integer DEFAULT 0 NOT NULL,
	"ng7" integer DEFAULT 0 NOT NULL,
	"ng8" integer DEFAULT 0 NOT NULL,
	"ng9" integer DEFAULT 0 NOT NULL,
	"ng10" integer DEFAULT 0 NOT NULL,
	"stki_snapshot" double precision
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"work_date" date NOT NULL,
	"member_id" integer NOT NULL,
	"submitted_by" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"leader_id" integer,
	"decided_at" timestamp with time zone,
	"leader_note" text,
	"needs_check" boolean DEFAULT false NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"pin_hash" text NOT NULL,
	"member_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_nik_unique" UNIQUE("nik")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_ng_group_id_ng_groups_id_fk" FOREIGN KEY ("ng_group_id") REFERENCES "public"."ng_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_time_rows" ADD CONSTRAINT "lost_time_rows_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_time_rows" ADD CONSTRAINT "lost_time_rows_lost_time_type_id_lost_time_types_id_fk" FOREIGN KEY ("lost_time_type_id") REFERENCES "public"."lost_time_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ng_codes" ADD CONSTRAINT "ng_codes_ng_group_id_ng_groups_id_fk" FOREIGN KEY ("ng_group_id") REFERENCES "public"."ng_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_rows" ADD CONSTRAINT "production_rows_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_rows" ADD CONSTRAINT "production_rows_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_rows" ADD CONSTRAINT "production_rows_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lost_time_rows_submission" ON "lost_time_rows" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machines_cat_mc" ON "machines" USING btree ("category_id","mc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "ng_codes_group_code" ON "ng_codes" USING btree ("ng_group_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "parts_cat_name_type" ON "parts" USING btree ("category_id","name","type");--> statement-breakpoint
CREATE INDEX "production_rows_submission" ON "production_rows" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_status" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_member_date" ON "submissions" USING btree ("member_id","work_date");
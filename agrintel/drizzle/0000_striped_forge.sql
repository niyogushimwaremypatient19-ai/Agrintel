CREATE TYPE "public"."access_status" AS ENUM('verified', 'awaiting_access', 'sample', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'watch', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('draft', 'reviewed', 'simulated', 'published');--> statement-breakpoint
CREATE TYPE "public"."commodity_category" AS ENUM('crop', 'livestock');--> statement-breakpoint
CREATE TYPE "public"."data_status" AS ENUM('observed', 'estimated', 'sample');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('received', 'validated', 'rejected', 'approved');--> statement-breakpoint
CREATE TYPE "public"."output_status" AS ENUM('forecast', 'scenario');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('low', 'moderate', 'high', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('steward', 'analyst', 'extension', 'public');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"district_code" varchar(32),
	"commodity_code" varchar(32),
	"audience" text NOT NULL,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"status" "alert_status" DEFAULT 'draft' NOT NULL,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"message_en" text NOT NULL,
	"message_rw" text,
	"explanation" text,
	"source_note" text,
	"triggered_by_import_id" integer,
	"risk_signal_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	CONSTRAINT "alerts_no_simulated_publish" CHECK (NOT ("alerts"."is_simulated" AND "alerts"."status" = 'published')),
	CONSTRAINT "alerts_validity_valid" CHECK ("alerts"."valid_to" > "alerts"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodities" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_rw" text NOT NULL,
	"category" "commodity_category" NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_rw" text NOT NULL,
	"province" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"method_version" text NOT NULL,
	"metric_code" varchar(48) NOT NULL,
	"district_code" varchar(32),
	"commodity_code" varchar(32),
	"holdout_start" date NOT NULL,
	"holdout_end" date NOT NULL,
	"mae" numeric(18, 4),
	"mape" numeric(9, 4),
	"rmse" numeric(18, 4),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_inputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"forecast_id" integer NOT NULL,
	"import_id" integer NOT NULL,
	"observation_count" integer DEFAULT 0 NOT NULL,
	"role" text
);
--> statement-breakpoint
CREATE TABLE "forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"district_code" varchar(32),
	"market_id" integer,
	"commodity_code" varchar(32) NOT NULL,
	"metric_code" varchar(48) NOT NULL,
	"method" text NOT NULL,
	"method_version" text NOT NULL,
	"output_status" "output_status" NOT NULL,
	"horizon_start" date NOT NULL,
	"horizon_end" date NOT NULL,
	"point_value" numeric(18, 4),
	"lower_bound" numeric(18, 4),
	"upper_bound" numeric(18, 4),
	"unit" text NOT NULL,
	"based_on_sample" boolean DEFAULT false NOT NULL,
	"confidence_note" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "forecasts_horizon_valid" CHECK ("forecasts"."horizon_end" >= "forecasts"."horizon_start")
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"district_code" varchar(32) NOT NULL,
	"source_id" integer
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"code" varchar(48) PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"unit" text NOT NULL,
	"geographic_level" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"district_code" varchar(32),
	"market_id" integer,
	"commodity_code" varchar(32),
	"metric_code" varchar(48) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" numeric(18, 4) NOT NULL,
	"unit" text NOT NULL,
	"data_status" "data_status" NOT NULL,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"filename" text NOT NULL,
	"storage_path" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"period_start" date,
	"period_end" date,
	"status" "import_status" DEFAULT 'received' NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" integer,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "risk_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"district_code" varchar(32) NOT NULL,
	"commodity_code" varchar(32) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"category" "risk_category" NOT NULL,
	"driver_summary" text,
	"forecast_id" integer,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"source_type" text NOT NULL,
	"access_status" "access_status" DEFAULT 'awaiting_access' NOT NULL,
	"access_method" text,
	"licence_note" text,
	"allowed_use" text,
	"geographic_coverage" text,
	"commodity_coverage" text,
	"coverage_start" date,
	"coverage_end" date,
	"update_frequency" text,
	"reference_url" text,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "validation_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"check_name" text NOT NULL,
	"severity" text NOT NULL,
	"passed" boolean NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"detail" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_commodity_code_commodities_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_triggered_by_import_id_raw_imports_id_fk" FOREIGN KEY ("triggered_by_import_id") REFERENCES "public"."raw_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_risk_signal_id_risk_signals_id_fk" FOREIGN KEY ("risk_signal_id") REFERENCES "public"."risk_signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_evaluations" ADD CONSTRAINT "forecast_evaluations_metric_code_metrics_code_fk" FOREIGN KEY ("metric_code") REFERENCES "public"."metrics"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_evaluations" ADD CONSTRAINT "forecast_evaluations_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_evaluations" ADD CONSTRAINT "forecast_evaluations_commodity_code_commodities_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_inputs" ADD CONSTRAINT "forecast_inputs_forecast_id_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_inputs" ADD CONSTRAINT "forecast_inputs_import_id_raw_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."raw_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_commodity_code_commodities_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_metric_code_metrics_code_fk" FOREIGN KEY ("metric_code") REFERENCES "public"."metrics"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_import_id_raw_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."raw_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_commodity_code_commodities_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_metric_code_metrics_code_fk" FOREIGN KEY ("metric_code") REFERENCES "public"."metrics"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_commodity_code_commodities_code_fk" FOREIGN KEY ("commodity_code") REFERENCES "public"."commodities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_forecast_id_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."forecasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_import_id_raw_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."raw_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_lookup_idx" ON "alerts" USING btree ("district_code","commodity_code","status");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "forecast_inputs_forecast_idx" ON "forecast_inputs" USING btree ("forecast_id");--> statement-breakpoint
CREATE INDEX "forecasts_lookup_idx" ON "forecasts" USING btree ("district_code","commodity_code","metric_code","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "markets_name_district_uq" ON "markets" USING btree ("name","district_code");--> statement-breakpoint
CREATE INDEX "obs_lookup_idx" ON "observations" USING btree ("district_code","commodity_code","metric_code","period_start");--> statement-breakpoint
CREATE INDEX "obs_import_idx" ON "observations" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "obs_natural_key_uq" ON "observations" USING btree ("source_id","metric_code",coalesce("district_code", ''),coalesce("market_id", 0),coalesce("commodity_code", ''),"period_start");--> statement-breakpoint
CREATE INDEX "raw_imports_sha_idx" ON "raw_imports" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "raw_imports_source_idx" ON "raw_imports" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "risk_lookup_idx" ON "risk_signals" USING btree ("district_code","commodity_code","is_current");--> statement-breakpoint
CREATE INDEX "validation_import_idx" ON "validation_results" USING btree ("import_id");
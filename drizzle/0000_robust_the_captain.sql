-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"rating" text NOT NULL,
	"user_query" text NOT NULL,
	"assistant_response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	CONSTRAINT "feedback_rating_check" CHECK (rating = ANY (ARRAY['up'::text, 'down'::text]))
);
--> statement-breakpoint
CREATE TABLE "market_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"sku" text NOT NULL,
	"title" text,
	"brand" text DEFAULT '',
	"price_current" real,
	"price_original" real,
	"discount_pct" real,
	"rating" real,
	"review_count" integer DEFAULT 0,
	"seller_name" text DEFAULT '',
	"is_sponsored" boolean DEFAULT false,
	"is_fulfilled" boolean DEFAULT false,
	"position" integer DEFAULT 0,
	"image_url" text DEFAULT '',
	"category_code" text DEFAULT '',
	"raw_json" text,
	"seller_type_code" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "market_sku_index" (
	"sku" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"title" text,
	"brand" text DEFAULT '',
	"seller_name" text DEFAULT '',
	"category_code" text DEFAULT '',
	"image_url" text DEFAULT '',
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"last_price" real,
	"last_rating" real,
	"last_review_count" integer DEFAULT 0,
	"observation_count" integer DEFAULT 1,
	"seller_type_code" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"keyword" text NOT NULL,
	"locale" text DEFAULT 'en-AE' NOT NULL,
	"market" text DEFAULT 'UAE' NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"total_results" integer DEFAULT 0,
	"product_count" integer DEFAULT 0,
	"sponsored_count" integer DEFAULT 0,
	"fulfilled_count" integer DEFAULT 0,
	"avg_rating" real DEFAULT 0,
	"avg_review_count" real DEFAULT 0,
	"price_min" real,
	"price_p25" real,
	"price_median" real,
	"price_p75" real,
	"price_max" real,
	"created_at" timestamp with time zone DEFAULT now(),
	"source" text DEFAULT 'daily_crawl',
	CONSTRAINT "market_snapshots_platform_keyword_timestamp_key" UNIQUE("platform","keyword","timestamp")
);
--> statement-breakpoint
CREATE TABLE "change_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_date" date NOT NULL,
	"platform" text DEFAULT 'noon' NOT NULL,
	"old_timestamp" timestamp with time zone,
	"new_timestamp" timestamp with time zone,
	"old_total" integer DEFAULT 0,
	"new_total" integer DEFAULT 0,
	"report_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_reports_date_platform_unique" UNIQUE("report_date","platform")
);
--> statement-breakpoint
CREATE TABLE "market_daily_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"keyword" text NOT NULL,
	"date" date NOT NULL,
	"total_results" integer,
	"price_median" real,
	"price_p25" real,
	"price_p75" real,
	"sponsored_count" integer,
	"avg_rating" real,
	"avg_review_count" real,
	"new_skus" integer DEFAULT 0,
	"dropped_skus" integer DEFAULT 0,
	CONSTRAINT "market_daily_metrics_platform_keyword_date_key" UNIQUE("platform","keyword","date")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT '新对话' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_categories" (
	"category_id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"category_name" text NOT NULL,
	"description" text NOT NULL,
	"keywords" text[] DEFAULT '{""}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_categories_platform_check" CHECK (platform = ANY (ARRAY['noon'::text, 'noon-ads'::text]))
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"title" text NOT NULL,
	"filename" text NOT NULL,
	"content" text NOT NULL,
	"category_id" text NOT NULL,
	"category_name" text NOT NULL,
	"char_count" integer NOT NULL,
	"source_url" text,
	"modified_time" timestamp with time zone,
	"embedding" vector(768),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text
);
--> statement-breakpoint
CREATE TABLE "keyword_categories" (
	"keyword" text NOT NULL,
	"market" text NOT NULL,
	"category_code" text NOT NULL,
	"category_name" text NOT NULL,
	"parent_code" text NOT NULL,
	"parent_name" text NOT NULL,
	"rank" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "keyword_categories_pkey" PRIMARY KEY("keyword","market","category_code")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"parent_message_id" text,
	"role" text NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"ordinal" integer NOT NULL,
	"is_active_child" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "messages_pkey" PRIMARY KEY("id","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "market_products" ADD CONSTRAINT "market_products_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."market_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_market_products_sku" ON "market_products" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_market_products_snapshot" ON "market_products" USING btree ("snapshot_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_market_products_snapshot_sku" ON "market_products" USING btree ("snapshot_id" int4_ops,"sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_market_snapshots_lookup" ON "market_snapshots" USING btree ("platform" text_ops,"keyword" timestamptz_ops,"timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_change_reports_date" ON "change_reports" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_user_id" ON "conversations" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_articles_category" ON "knowledge_articles" USING btree ("category_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_articles_embedding" ON "knowledge_articles" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE INDEX "idx_articles_platform" ON "knowledge_articles" USING btree ("platform" text_ops);--> statement-breakpoint
CREATE INDEX "idx_keyword_categories_parent" ON "keyword_categories" USING btree ("parent_code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_messages_parent" ON "messages" USING btree ("conversation_id" text_ops,"parent_message_id" text_ops);
*/
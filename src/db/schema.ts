import { pgTable, check, serial, text, timestamp, index, uniqueIndex, foreignKey, integer, real, boolean, unique, date, jsonb, vector, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const feedback = pgTable("feedback", {
	id: serial().primaryKey().notNull(),
	rating: text().notNull(),
	userQuery: text("user_query").notNull(),
	assistantResponse: text("assistant_response").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id"),
}, (table) => [
	check("feedback_rating_check", sql`rating = ANY (ARRAY['up'::text, 'down'::text])`),
]);

export const marketProducts = pgTable("market_products", {
	id: serial().primaryKey().notNull(),
	snapshotId: integer("snapshot_id").notNull(),
	sku: text().notNull(),
	title: text(),
	brand: text().default(''),
	priceCurrent: real("price_current"),
	priceOriginal: real("price_original"),
	discountPct: real("discount_pct"),
	rating: real(),
	reviewCount: integer("review_count").default(0),
	sellerName: text("seller_name").default(''),
	isSponsored: boolean("is_sponsored").default(false),
	isFulfilled: boolean("is_fulfilled").default(false),
	position: integer().default(0),
	imageUrl: text("image_url").default(''),
	categoryCode: text("category_code").default(''),
	rawJson: text("raw_json"),
	sellerTypeCode: text("seller_type_code").default(''),
}, (table) => [
	index("idx_market_products_sku").using("btree", table.sku.asc().nullsLast().op("text_ops")),
	index("idx_market_products_snapshot").using("btree", table.snapshotId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("idx_market_products_snapshot_sku").using("btree", table.snapshotId.asc().nullsLast().op("int4_ops"), table.sku.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.snapshotId],
			foreignColumns: [marketSnapshots.id],
			name: "market_products_snapshot_id_fkey"
		}),
]);

export const marketSkuIndex = pgTable("market_sku_index", {
	sku: text().primaryKey().notNull(),
	platform: text().notNull(),
	title: text(),
	brand: text().default(''),
	sellerName: text("seller_name").default(''),
	categoryCode: text("category_code").default(''),
	imageUrl: text("image_url").default(''),
	firstSeen: timestamp("first_seen", { withTimezone: true, mode: 'string' }).notNull(),
	lastSeen: timestamp("last_seen", { withTimezone: true, mode: 'string' }).notNull(),
	lastPrice: real("last_price"),
	lastRating: real("last_rating"),
	lastReviewCount: integer("last_review_count").default(0),
	observationCount: integer("observation_count").default(1),
	sellerTypeCode: text("seller_type_code").default(''),
});

export const marketSnapshots = pgTable("market_snapshots", {
	id: serial().primaryKey().notNull(),
	platform: text().notNull(),
	keyword: text().notNull(),
	locale: text().default('en-AE').notNull(),
	market: text().default('UAE').notNull(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	totalResults: integer("total_results").default(0),
	productCount: integer("product_count").default(0),
	sponsoredCount: integer("sponsored_count").default(0),
	fulfilledCount: integer("fulfilled_count").default(0),
	avgRating: real("avg_rating").default(0),
	avgReviewCount: real("avg_review_count").default(0),
	priceMin: real("price_min"),
	priceP25: real("price_p25"),
	priceMedian: real("price_median"),
	priceP75: real("price_p75"),
	priceMax: real("price_max"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	source: text().default('daily_crawl'),
}, (table) => [
	index("idx_market_snapshots_lookup").using("btree", table.platform.asc().nullsLast().op("text_ops"), table.keyword.asc().nullsLast().op("timestamptz_ops"), table.timestamp.asc().nullsLast().op("timestamptz_ops")),
	unique("market_snapshots_platform_keyword_timestamp_key").on(table.platform, table.keyword, table.timestamp),
]);

export const changeReports = pgTable("change_reports", {
	id: serial().primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	platform: text().default('noon').notNull(),
	oldTimestamp: timestamp("old_timestamp", { withTimezone: true, mode: 'string' }),
	newTimestamp: timestamp("new_timestamp", { withTimezone: true, mode: 'string' }),
	oldTotal: integer("old_total").default(0),
	newTotal: integer("new_total").default(0),
	reportData: jsonb("report_data").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_change_reports_date").using("btree", table.reportDate.desc().nullsFirst().op("date_ops")),
	unique("change_reports_date_platform_unique").on(table.reportDate, table.platform),
]);

export const marketDailyMetrics = pgTable("market_daily_metrics", {
	id: serial().primaryKey().notNull(),
	platform: text().notNull(),
	keyword: text().notNull(),
	date: date().notNull(),
	totalResults: integer("total_results"),
	priceMedian: real("price_median"),
	priceP25: real("price_p25"),
	priceP75: real("price_p75"),
	sponsoredCount: integer("sponsored_count"),
	avgRating: real("avg_rating"),
	avgReviewCount: real("avg_review_count"),
	newSkus: integer("new_skus").default(0),
	droppedSkus: integer("dropped_skus").default(0),
}, (table) => [
	unique("market_daily_metrics_platform_keyword_date_key").on(table.platform, table.keyword, table.date),
]);

export const conversations = pgTable("conversations", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text().default('新对话').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_conversations_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const knowledgeCategories = pgTable("knowledge_categories", {
	categoryId: text("category_id").primaryKey().notNull(),
	platform: text().notNull(),
	categoryName: text("category_name").notNull(),
	description: text().notNull(),
	keywords: text().array().default([""]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("knowledge_categories_platform_check", sql`platform = ANY (ARRAY['noon'::text, 'noon-ads'::text])`),
]);

export const knowledgeArticles = pgTable("knowledge_articles", {
	id: text().primaryKey().notNull(),
	platform: text().notNull(),
	title: text().notNull(),
	filename: text().notNull(),
	content: text().notNull(),
	categoryId: text("category_id").notNull(),
	categoryName: text("category_name").notNull(),
	charCount: integer("char_count").notNull(),
	sourceUrl: text("source_url"),
	modifiedTime: timestamp("modified_time", { withTimezone: true, mode: 'string' }),
	embedding: vector({ dimensions: 768 }),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	contentHash: text("content_hash"),
}, (table) => [
	index("idx_articles_category").using("btree", table.categoryId.asc().nullsLast().op("text_ops")),
	index("idx_articles_embedding").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")).with({m: "16",ef_construction: "64"}),
	index("idx_articles_platform").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [knowledgeCategories.categoryId],
			name: "knowledge_articles_category_id_fkey"
		}),
]);

export const keywordCategories = pgTable("keyword_categories", {
	keyword: text().notNull(),
	market: text().notNull(),
	categoryCode: text("category_code").notNull(),
	categoryName: text("category_name").notNull(),
	parentCode: text("parent_code").notNull(),
	parentName: text("parent_name").notNull(),
	rank: integer().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_keyword_categories_parent").using("btree", table.parentCode.asc().nullsLast().op("text_ops")),
	primaryKey({ columns: [table.keyword, table.market, table.categoryCode], name: "keyword_categories_pkey"}),
]);

export const messages = pgTable("messages", {
	id: text().notNull(),
	conversationId: text("conversation_id").notNull(),
	parentMessageId: text("parent_message_id"),
	role: text().notNull(),
	parts: jsonb().default([]).notNull(),
	status: text().default('complete').notNull(),
	ordinal: integer().notNull(),
	isActiveChild: boolean("is_active_child").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_messages_conversation").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("idx_messages_parent").using("btree", table.conversationId.asc().nullsLast().op("text_ops"), table.parentMessageId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.id, table.conversationId], name: "messages_pkey"}),
]);

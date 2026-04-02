-- =============================================================================
-- Knowledge Base Migration Script
-- =============================================================================
-- Purpose: Creates the knowledge base tables in Neon PostgreSQL, enabling
--          vector similarity search over categorised knowledge articles using
--          the pgvector extension (text-embedding-005, 768-dimensional vectors).
--
-- How to run:
--   psql $DATABASE_URL -f scripts/migrate-knowledge-base.sql
-- =============================================================================

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Table: knowledge_categories
-- Stores top-level category metadata for both platforms.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_categories (
    category_id   TEXT        PRIMARY KEY,
    platform      TEXT        NOT NULL CHECK (platform IN ('noon', 'noon-ads')),
    category_name TEXT        NOT NULL,
    description   TEXT        NOT NULL,
    keywords      TEXT[]      NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table: knowledge_articles
-- Stores individual knowledge-base articles with their markdown content and
-- pre-computed embeddings for semantic retrieval.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id            TEXT        PRIMARY KEY,
    platform      TEXT        NOT NULL,
    title         TEXT        NOT NULL,
    filename      TEXT        NOT NULL,
    content       TEXT        NOT NULL,
    category_id   TEXT        NOT NULL REFERENCES knowledge_categories (category_id),
    category_name TEXT        NOT NULL,
    char_count    INTEGER     NOT NULL,
    source_url    TEXT,
    modified_time TIMESTAMPTZ,
    embedding     VECTOR(768),
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Fast lookup of articles by category
CREATE INDEX IF NOT EXISTS idx_articles_category
    ON knowledge_articles (category_id);

-- Fast lookup of articles by platform
CREATE INDEX IF NOT EXISTS idx_articles_platform
    ON knowledge_articles (platform);

-- HNSW index for approximate nearest-neighbour search on embeddings
-- using cosine distance (suited for normalised text embeddings).
CREATE INDEX IF NOT EXISTS idx_articles_embedding
    ON knowledge_articles
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

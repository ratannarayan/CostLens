-- ============================================================
-- CostLens — Database Schema
-- PostgreSQL (Supabase / Neon / RDS compatible)
-- Version: 1.0 | March 2026
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt hash
    name            VARCHAR(150) NOT NULL,
    company         VARCHAR(255),
    designation     VARCHAR(150),
    phone           VARCHAR(20),
    industry        VARCHAR(100),                    -- e.g., 'Automotive Components'
    
    -- Plan & Credits
    plan            VARCHAR(20) NOT NULL DEFAULT 'free',   -- free | pro | team | enterprise
    credits         INTEGER NOT NULL DEFAULT 0,
    free_price_checks INTEGER NOT NULL DEFAULT 2,          -- Free tier: 2 free price checks
    credits_reset_at TIMESTAMP WITH TIME ZONE,             -- When credits next refresh
    
    -- Billing
    stripe_customer_id    VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    billing_cycle         VARCHAR(10) DEFAULT 'monthly',   -- monthly | annual
    plan_expires_at       TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    email_verified  BOOLEAN DEFAULT FALSE,
    avatar_url      VARCHAR(500),
    last_login_at   TIMESTAMP WITH TIME ZONE,
    login_count     INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan ON users(plan);

-- ============================================================
-- 2. SESSIONS (JWT alternative — server-side sessions)
-- ============================================================
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500) UNIQUE NOT NULL,     -- Session token
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ============================================================
-- 3. MODULE ANALYSES (all 13 costing modules)
-- ============================================================
CREATE TABLE module_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id       VARCHAR(50) NOT NULL,             -- should-cost, tool-cost, landed-cost, etc.
    
    -- Input data
    input_name      VARCHAR(255),                     -- User's label for this analysis
    input_data      JSONB NOT NULL,                   -- All form fields as JSON
    input_files     TEXT[],                           -- S3/GCS URLs of uploaded files
    
    -- Result data
    result_data     JSONB,                            -- Full calculation result
    result_value    VARCHAR(100),                     -- Primary result (e.g., "₹240/pc")
    
    -- AI extraction data (Pro only)
    ai_extracted    BOOLEAN DEFAULT FALSE,            -- Was AI used?
    ai_credits_used INTEGER DEFAULT 0,
    
    -- Metadata
    is_starred      BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analyses_user ON module_analyses(user_id);
CREATE INDEX idx_analyses_module ON module_analyses(module_id);
CREATE INDEX idx_analyses_created ON module_analyses(created_at DESC);

-- ============================================================
-- 4. REPORT ANALYSES (8 on-demand reports)
-- ============================================================
CREATE TABLE report_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id       VARCHAR(50) NOT NULL,             -- spend, price-variance, inventory-health, etc.
    
    -- Input
    input_files     TEXT[],                           -- S3/GCS URLs of uploaded data files
    mapped_data     TEXT,                             -- CSV after column mapping
    notes           TEXT,
    
    -- AI Result
    ai_result       JSONB,                            -- Full AI analysis result
    ai_credits_used INTEGER DEFAULT 0,
    
    -- Expert Review
    expert_requested    BOOLEAN DEFAULT FALSE,
    expert_status       VARCHAR(20),                  -- pending | in-progress | delivered
    expert_requested_at TIMESTAMP WITH TIME ZONE,
    expert_delivered_at TIMESTAMP WITH TIME ZONE,
    expert_result_url   VARCHAR(500),                 -- URL to expert PDF
    expert_payment_id   VARCHAR(255),
    
    -- Metadata
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_user ON report_analyses(user_id);
CREATE INDEX idx_reports_type ON report_analyses(report_id);

-- ============================================================
-- 5. AI TOOL ANALYSES (4 commercial tools)
-- ============================================================
CREATE TABLE tool_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id         VARCHAR(50) NOT NULL,             -- price-check, contract-analyzer, rfq-comparator, negotiation-brief
    
    -- Input
    input_data      JSONB,                            -- Form fields
    input_files     TEXT[],                           -- Uploaded file URLs
    notes           TEXT,
    
    -- Result
    ai_result       JSONB NOT NULL,                   -- Full AI analysis result
    credits_used    INTEGER DEFAULT 0,
    used_free_check BOOLEAN DEFAULT FALSE,            -- Was this a free price check?
    
    -- Metadata
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tools_user ON tool_analyses(user_id);
CREATE INDEX idx_tools_type ON tool_analyses(tool_id);

-- ============================================================
-- 6. EMAIL DRAFTS (Smart Actions)
-- ============================================================
CREATE TABLE email_drafts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Source context
    source_type     VARCHAR(20) NOT NULL,             -- tool | report
    source_id       UUID,                             -- FK to tool_analyses or report_analyses
    email_type      VARCHAR(50) NOT NULL,             -- price-reduction, amendment-request, etc.
    
    -- Email content
    subject         TEXT NOT NULL,
    body            TEXT NOT NULL,
    
    -- Usage tracking
    copied          BOOLEAN DEFAULT FALSE,
    opened_in_mail  BOOLEAN DEFAULT FALSE,
    credits_used    INTEGER DEFAULT 1,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_emails_user ON email_drafts(user_id);

-- ============================================================
-- 7. CREDIT TRANSACTIONS (Audit Trail)
-- ============================================================
CREATE TABLE credit_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type            VARCHAR(30) NOT NULL,             -- allocation | usage | refund | expiry
    amount          INTEGER NOT NULL,                 -- positive = credit, negative = debit
    balance_after   INTEGER NOT NULL,                 -- Balance after transaction
    
    -- Context
    description     VARCHAR(255),                     -- e.g., "Price Check — CNC Housing"
    reference_type  VARCHAR(20),                      -- module | report | tool | email | subscription
    reference_id    UUID,                             -- FK to source
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credits_user ON credit_transactions(user_id);
CREATE INDEX idx_credits_created ON credit_transactions(created_at DESC);

-- ============================================================
-- 8. FILE UPLOADS
-- ============================================================
CREATE TABLE file_uploads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    original_name   VARCHAR(500) NOT NULL,
    storage_url     VARCHAR(1000) NOT NULL,           -- S3/GCS URL
    mime_type       VARCHAR(100),
    file_size       BIGINT,                           -- bytes
    
    -- Context
    upload_context  VARCHAR(20),                      -- module | report | tool
    reference_id    UUID,
    
    -- Auto-cleanup
    expires_at      TIMESTAMP WITH TIME ZONE,         -- Auto-delete after X days
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_user ON file_uploads(user_id);

-- ============================================================
-- 9. EBOOK DOWNLOADS
-- ============================================================
CREATE TABLE ebook_downloads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ebook_id        VARCHAR(20) NOT NULL,             -- book-1 through book-10
    download_type   VARCHAR(10) NOT NULL,             -- preview | full
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ebooks_user ON ebook_downloads(user_id);

-- ============================================================
-- 10. TEAMS (for Team/Enterprise plans)
-- ============================================================
CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    owner_id        UUID NOT NULL REFERENCES users(id),
    plan            VARCHAR(20) NOT NULL DEFAULT 'team',  -- team | enterprise
    max_members     INTEGER NOT NULL DEFAULT 5,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE team_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'member',  -- admin | member
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- ============================================================
-- 11. WAITLIST / LEADS (pre-launch)
-- ============================================================
CREATE TABLE waitlist (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(150),
    company         VARCHAR(255),
    source          VARCHAR(50),                      -- landing-page, ebook, report, etc.
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 12. ANALYTICS EVENTS
-- ============================================================
CREATE TABLE analytics_events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    event_name      VARCHAR(100) NOT NULL,            -- page_view, module_opened, report_run, etc.
    event_data      JSONB,
    session_id      UUID,
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_event ON analytics_events(event_name);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER analyses_updated_at BEFORE UPDATE ON module_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON report_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Monthly credit reset function (call via cron)
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
    UPDATE users
    SET credits = CASE
        WHEN plan = 'pro' THEN 50
        WHEN plan = 'team' THEN 50
        WHEN plan = 'enterprise' THEN 999
        ELSE 0
    END,
    free_price_checks = CASE WHEN plan = 'free' THEN 2 ELSE 0 END,
    credits_reset_at = NOW() + INTERVAL '1 month'
    WHERE plan != 'free' OR free_price_checks < 2;
    
    -- Log the allocations
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, reference_type)
    SELECT id, 'allocation',
        CASE WHEN plan = 'pro' THEN 50 WHEN plan = 'team' THEN 50 WHEN plan = 'enterprise' THEN 999 ELSE 0 END,
        credits,
        'Monthly credit allocation — ' || plan || ' plan',
        'subscription'
    FROM users WHERE plan != 'free';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA — Plan configuration (reference table)
-- ============================================================
CREATE TABLE plan_config (
    plan_id         VARCHAR(20) PRIMARY KEY,
    display_name    VARCHAR(50) NOT NULL,
    monthly_price   INTEGER NOT NULL,                -- INR, 0 for free
    annual_price    INTEGER NOT NULL,                -- INR, 0 for free
    monthly_credits INTEGER NOT NULL,
    max_users       INTEGER NOT NULL DEFAULT 1,
    free_price_checks INTEGER NOT NULL DEFAULT 0,
    features        JSONB
);

INSERT INTO plan_config VALUES
('free',       'Starter',        0,     0,      0,  1, 2, '{"modules":true,"templates":true,"ai_extraction":false,"reports":false,"pdf_export":false,"history_limit":5}'),
('pro',        'Professional',   1999,  19999,  50, 1, 0, '{"modules":true,"templates":true,"ai_extraction":true,"reports":true,"pdf_export":true,"history_limit":-1}'),
('team',       'Team',           4999,  49999,  50, 5, 0, '{"modules":true,"templates":true,"ai_extraction":true,"reports":true,"pdf_export":true,"history_limit":-1,"team_dashboard":true}'),
('enterprise', 'Enterprise',    0,     0,      999,999,0, '{"modules":true,"templates":true,"ai_extraction":true,"reports":true,"pdf_export":true,"history_limit":-1,"team_dashboard":true,"sso":true,"api_access":true}');

-- ============================================================
-- CREDIT COSTS (reference table)
-- ============================================================
CREATE TABLE credit_costs (
    feature_id      VARCHAR(50) PRIMARY KEY,
    feature_type    VARCHAR(20) NOT NULL,             -- module | report | tool | email
    display_name    VARCHAR(100) NOT NULL,
    credits_cost    INTEGER NOT NULL,
    description     VARCHAR(255)
);

INSERT INTO credit_costs VALUES
-- Modules (AI extraction)
('should-cost-ai',    'module', 'Should-Cost AI Extraction',      2, 'AI extracts BOM, processes from drawing'),
('tool-cost-ai',      'module', 'Tool Cost AI Extraction',        2, 'AI extracts tool specs from drawing'),
('generic-module-ai', 'module', 'Module AI Extraction',           1, 'AI extracts data from uploaded docs'),
-- Reports
('spend',             'report', 'Spend Analysis',                 3, NULL),
('price-variance',    'report', 'Price Variance Report',          2, NULL),
('inventory-health',  'report', 'Inventory Health Analysis',      2, NULL),
('supplier-scorecard','report', 'Supplier Performance Scorecard', 2, NULL),
('category-opportunity','report','Category Opportunity Analysis', 3, NULL),
('cost-reduction-tracker','report','Cost Reduction Tracker',      2, NULL),
('savings-validation','report', 'Savings Validation',             3, NULL),
('supplier-risk',     'report', 'Supplier Risk Heat Map',         2, NULL),
-- AI Tools
('price-check',       'tool',   'Price Reasonableness Check',     1, 'Free tier gets 2 free checks'),
('contract-analyzer', 'tool',   'Contract Clause Analyzer',       3, NULL),
('rfq-comparator',    'tool',   'RFQ Response Comparator',        3, NULL),
('negotiation-brief', 'tool',   'Negotiation Prep Brief',         2, NULL),
-- Emails
('smart-email',       'email',  'Smart Action Email Draft',       1, 'AI-drafted email from analysis results');

-- ============================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE newsletter_subscribers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,  -- linked if registered
    source          VARCHAR(50) DEFAULT 'website',                 -- website, landing, ebook, webinar
    status          VARCHAR(20) NOT NULL DEFAULT 'active',         -- active, unsubscribed
    subscribed_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    resubscribed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_status ON newsletter_subscribers(status);


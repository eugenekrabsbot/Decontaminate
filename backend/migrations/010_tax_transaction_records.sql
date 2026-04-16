-- Migration: 010_tax_transaction_records
-- Purpose: Track postal code, base charge, and sales tax for every transaction
-- Disruption: NONE — new table only, no schema changes to existing tables

-- ============================================================
-- STEP 1: Create the new tax_transactions table
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date    TIMESTAMP NOT NULL DEFAULT NOW(),
    postal_code         VARCHAR(20) NOT NULL DEFAULT '',
    country             VARCHAR(10) NOT NULL DEFAULT 'USA',
    state               VARCHAR(10) NOT NULL DEFAULT '',
    base_charge_cents   INTEGER NOT NULL DEFAULT 0,
    tax_rate            NUMERIC(6,4) NOT NULL DEFAULT 0,
    tax_amount_cents    INTEGER NOT NULL DEFAULT 0,
    total_amount_cents  INTEGER NOT NULL DEFAULT 0,
    invoice_number      VARCHAR(100),
    subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_id          UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for tax reporting queries (by date range, postal code, state)
CREATE INDEX IF NOT EXISTS idx_tax_transactions_date ON tax_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tax_transactions_postal ON tax_transactions(postal_code);
CREATE INDEX IF NOT EXISTS idx_tax_transactions_state ON tax_transactions(state);
CREATE INDEX IF NOT EXISTS idx_tax_transactions_subscription ON tax_transactions(subscription_id);

-- ============================================================
-- STEP 2: Backfill from existing subscription metadata
-- Existing rows that have postal_code in metadata get populated here.
-- This does NOT modify any existing tables — only inserts into the new one.
-- ============================================================
DO $$
DECLARE
    row_record RECORD;
    inv_num    VARCHAR(100);
    postal_val VARCHAR(20);
    state_val  VARCHAR(10);
    country_val VARCHAR(10);
    tax_rate_val NUMERIC(6,4);
    plan_amt   INTEGER;
    tax_amt    INTEGER;
    total_amt  INTEGER;
BEGIN
    FOR row_record IN
        SELECT
            s.id AS sub_id,
            s.user_id,
            s.account_number,
            s.metadata,
            s.created_at AS transaction_date
        FROM subscriptions s
        WHERE s.metadata IS NOT NULL
          AND s.metadata ? 'postal_code'
    LOOP
        -- Safely extract values from JSONB metadata
        postal_val  := COALESCE(row_record.metadata->>'postal_code', '');
        state_val   := COALESCE(row_record.metadata->>'state', '');
        country_val := COALESCE(row_record.metadata->>'country', 'USA');
        tax_rate_val := COALESCE((row_record.metadata->>'tax_rate')::NUMERIC, 0);
        plan_amt    := COALESCE((row_record.metadata->>'plan_amount_cents')::INTEGER, 0);
        tax_amt     := COALESCE((row_record.metadata->>'tax_amount_cents')::INTEGER, 0);
        total_amt   := COALESCE((row_record.metadata->>'total_amount_cents')::INTEGER, 0);
        inv_num     := COALESCE(row_record.metadata->>'invoice_number', '');

        -- Skip rows with no postal code or no plan amount
        CONTINUE WHEN postal_val = '' OR plan_amt = 0;

        -- Insert only if not already recorded (idempotent)
        INSERT INTO tax_transactions (
            transaction_date, postal_code, country, state,
            base_charge_cents, tax_rate, tax_amount_cents, total_amount_cents,
            invoice_number, subscription_id, user_id
        )
        VALUES (
            row_record.transaction_date, postal_val, country_val, state_val,
            plan_amt, tax_rate_val, tax_amt, total_amt,
            inv_num, row_record.sub_id, row_record.user_id
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

-- ============================================================
-- STEP 3: Log completion
-- ============================================================
RAISE NOTICE 'Migration 010 complete: tax_transactions table created and backfilled.';
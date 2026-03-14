-- ─────────────────────────────────────────────
-- Plan field on admin_profiles
-- ─────────────────────────────────────────────
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'advanced', 'enterprise'));

-- ─────────────────────────────────────────────
-- Plan change history
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_change_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    changed_by uuid NOT NULL,
    previous_plan text,
    new_plan text NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_change_history_user_id ON plan_change_history(user_id);

-- ─────────────────────────────────────────────
-- Commission overrides
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    fee_percentage numeric(5,2) NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_overrides_user_id ON commission_overrides(user_id);

-- ─────────────────────────────────────────────
-- Admin broadcasts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'maintenance')),
    target_all boolean NOT NULL DEFAULT true,
    target_plan text,
    status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'archived')),
    sent_by uuid,
    sent_by_email text,
    sent_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Support tickets
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject text NOT NULL,
    description text NOT NULL,
    category text NOT NULL DEFAULT 'general'
        CHECK (category IN ('general', 'billing', 'technical', 'account', 'payout', 'other')),
    priority text NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
    assigned_to uuid REFERENCES auth.users(id),
    internal_notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_tickets_owner" ON support_tickets;
CREATE POLICY "support_tickets_owner" ON support_tickets
    FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Support ticket replies
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    author_email text,
    message text NOT NULL,
    is_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket_id ON support_ticket_replies(ticket_id);

-- RLS
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_replies_visible" ON support_ticket_replies;
CREATE POLICY "ticket_replies_visible" ON support_ticket_replies
    FOR SELECT USING (
        auth.uid() = author_id OR
        EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_id AND st.user_id = auth.uid())
    );
DROP POLICY IF EXISTS "ticket_replies_insert" ON support_ticket_replies;
CREATE POLICY "ticket_replies_insert" ON support_ticket_replies
    FOR INSERT WITH CHECK (auth.uid() = author_id);

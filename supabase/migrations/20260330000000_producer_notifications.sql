-- ─────────────────────────────────────────────
-- Notificações para produtores (donos de plataforma)
-- Separada de user_notifications (que é para consumidores de apps)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS producer_notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       text NOT NULL,
    message     text NOT NULL,
    type        text NOT NULL DEFAULT 'info'
        CHECK (type IN ('info', 'warning', 'success', 'error', 'maintenance', 'admin_broadcast')),
    read        boolean NOT NULL DEFAULT false,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producer_notifications_user_id ON producer_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_producer_notifications_read   ON producer_notifications(user_id, read);

-- RLS — produtor lê e atualiza apenas as próprias notificações
ALTER TABLE producer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "producer_notif_select" ON producer_notifications;
CREATE POLICY "producer_notif_select" ON producer_notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "producer_notif_update" ON producer_notifications;
CREATE POLICY "producer_notif_update" ON producer_notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

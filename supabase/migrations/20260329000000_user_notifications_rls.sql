-- ─────────────────────────────────────────────
-- RLS para user_notifications
-- Permite que produtores leiam e marquem como lidas
-- as próprias notificações (enviadas pelo superadmin ou sistema)
-- ─────────────────────────────────────────────
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_owner_select" ON user_notifications;
CREATE POLICY "user_notifications_owner_select" ON user_notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_notifications_owner_update" ON user_notifications;
CREATE POLICY "user_notifications_owner_update" ON user_notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

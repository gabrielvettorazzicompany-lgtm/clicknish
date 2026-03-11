-- Remove foreign key constraint that forces app_users.user_id to reference auth.users
-- Now user_id can reference customer_auth.id instead
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_user_id_fkey;

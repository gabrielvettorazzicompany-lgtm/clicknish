-- Migration: Mollie Mandate Support for 1-click upsell
-- Adiciona colunas para armazenar cliente/mandato Mollie e permitir cobranças recorrentes

-- user_product_access: guardar referências Mollie para 1-click

ALTER TABLE user_product_access
  ADD COLUMN IF NOT EXISTS mollie_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS mollie_mandate_id  TEXT;

-- mollie_payments: registrar qual cliente Mollie foi usado e o tipo de sequência

ALTER TABLE mollie_payments
  ADD COLUMN IF NOT EXISTS mollie_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS sequence_type      TEXT DEFAULT 'oneoff';

COMMENT ON COLUMN user_product_access.mollie_customer_id IS
  'ID do cliente Mollie (cus_xxx) para cobranças recorrentes via 1-click';
COMMENT ON COLUMN user_product_access.mollie_mandate_id IS
  'ID do mandato Mollie (mdt_xxx) para cobranças recorrentes via 1-click';
COMMENT ON COLUMN mollie_payments.mollie_customer_id IS
  'ID do cliente Mollie associado a este pagamento';
COMMENT ON COLUMN mollie_payments.sequence_type IS
  'Tipo de sequência Mollie: oneoff | first | recurring';

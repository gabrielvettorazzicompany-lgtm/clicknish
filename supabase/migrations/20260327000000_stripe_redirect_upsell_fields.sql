-- Adiciona campos para suporte a upsell via iDEAL Stripe redirect
ALTER TABLE stripe_redirect_payments
    ADD COLUMN IF NOT EXISTS is_upsell boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES checkout_offers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS original_purchase_id uuid;

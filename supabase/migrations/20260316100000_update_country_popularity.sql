-- Atualiza country_popularity dos métodos Mollie com base na lista de
-- melhores métodos por país (100 países).
--
-- Lógica de rank:
--   1 = creditcard (sempre, implícito)
--   2 = melhor método local disponível na Mollie
--   3 = segundo melhor método local disponível na Mollie
--
-- Métodos não suportados pela Mollie (Pix, Bizum, Vipps, MobilePay,
-- GrabPay, OXXO, Mercado Pago, etc.) são ignorados. Quando o método
-- de rank 2 do país não existe na Mollie, o método de rank 3 é
-- promovido para rank 2 (melhor alternativa disponível).

UPDATE mollie_payment_methods SET country_popularity = CASE id

    -- ── Cartão: sempre disponível em todos os países ──────────────────
    WHEN 'creditcard'   THEN '{"*":1}'::jsonb

    -- ── PayPal ────────────────────────────────────────────────────────
    -- Europa
    -- US/CA/GB/IE/MT/FR/ES/HR: rank 2 (Cartes Bancaires, Bizum, Aircash = N/A Mollie)
    -- NL/BE: rank 3 (iDEAL e Bancontact são rank 2)
    -- IT: rank 2 (Satispay fica rank 3)
    -- GR/CZ/HU/RO/BG/SK/LT/LV/EE: promotado para rank 2 (método original não está na Mollie)
    -- SI: rank 2 (Bank Transfer fica rank 3)
    -- América Latina: promotado para rank 2 (Pix, OXXO, Mercado Pago, etc. não disponíveis)
    -- Médio Oriente: QA rank 3 (Apple Pay é rank 2 no QA), IL promotado rank 2
    -- Oceânia: AU rank 2, NZ promotado rank 2
    WHEN 'paypal'       THEN '{
        "US":2,"CA":2,"GB":2,"FR":2,"ES":2,"IT":2,"NL":3,"BE":3,
        "IE":2,"GR":2,"CZ":2,"HU":2,"RO":2,"BG":2,"HR":2,"SK":2,
        "SI":2,"LT":2,"LV":2,"EE":2,"MT":2,
        "BR":2,"MX":2,"AR":2,"PE":2,"UY":2,"PY":2,"BO":2,"EC":2,
        "DO":2,"PA":2,"CR":2,"GT":2,"SV":2,
        "QA":3,"IL":2,
        "AU":2,"NZ":2
    }'::jsonb

    -- ── Apple Pay ─────────────────────────────────────────────────────
    -- US/CA/GB/IE/MT: rank 3 (PayPal é rank 2)
    -- AE: rank 2 (Tabby não está na Mollie)
    -- SA: promotado rank 2 (Mada não está na Mollie)
    -- QA: rank 2
    -- KW: promotado rank 2 (KNET não está na Mollie)
    -- BH: promotado rank 2 (Benefit Pay não está na Mollie)
    WHEN 'applepay'     THEN '{
        "US":3,"CA":3,"GB":3,"IE":3,"MT":3,
        "AE":2,"SA":2,"QA":2,"KW":2,"BH":2
    }'::jsonb

    -- ── Klarna ────────────────────────────────────────────────────────
    -- DE/AT: rank 2
    -- SE/FI: rank 2
    -- NO/DK: promotado rank 2 (Vipps e MobilePay não estão na Mollie)
    WHEN 'klarna'       THEN '{"DE":2,"AT":2,"SE":2,"FI":2,"NO":2,"DK":2}'::jsonb

    -- ── Sofort ────────────────────────────────────────────────────────
    WHEN 'sofort'       THEN '{"DE":3,"AT":3}'::jsonb

    -- ── iDEAL ─────────────────────────────────────────────────────────
    WHEN 'ideal'        THEN '{"NL":2}'::jsonb

    -- ── Bancontact ────────────────────────────────────────────────────
    WHEN 'bancontact'   THEN '{"BE":2}'::jsonb

    -- ── TWINT ─────────────────────────────────────────────────────────
    WHEN 'twint'        THEN '{"CH":2}'::jsonb

    -- ── Satispay ──────────────────────────────────────────────────────
    WHEN 'satispay'     THEN '{"IT":3}'::jsonb

    -- ── MB Way ────────────────────────────────────────────────────────
    WHEN 'mbway'        THEN '{"PT":2}'::jsonb

    -- ── Multibanco ────────────────────────────────────────────────────
    WHEN 'mb'           THEN '{"PT":3}'::jsonb

    -- ── BLIK ──────────────────────────────────────────────────────────
    WHEN 'blik'         THEN '{"PL":2}'::jsonb

    -- ── Przelewy24 ────────────────────────────────────────────────────
    WHEN 'przelewy24'   THEN '{"PL":3}'::jsonb

    -- ── Swish ─────────────────────────────────────────────────────────
    WHEN 'swish'        THEN '{"SE":3}'::jsonb

    -- ── Bank Transfer ─────────────────────────────────────────────────
    WHEN 'banktransfer' THEN '{"SI":3}'::jsonb

    -- ── Métodos sem destaque regional na lista ─────────────────────────
    -- (eps, giropay, wero, belfius, kbc, paybybank, googlepay, trustly, etc.)
    ELSE '{}'::jsonb

END;

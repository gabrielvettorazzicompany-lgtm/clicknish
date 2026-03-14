-- Fix: order bumps apareciam duplicados no checkout quando havia linhas
-- duplicadas em checkout_offers para o mesmo product_id e checkout_id.
--
-- Causa: ao editar bumps no funil, às vezes era criada uma nova linha em vez
-- de atualizar a existente, resultando em 2+ rows para o mesmo produto.
--
-- Correção em duas etapas:
--   1. Limpar linhas duplicadas no banco (mantém a com funnel_id preenchido e
--      product_description não padrão; remove as demais).
--   2. Atualizar get_checkout_data_v2 para usar DISTINCT ON (product_id),
--      eliminando duplicados mesmo que existam no banco.

-- ============================================================
-- 1. Remover duplicatas de checkout_offers
--    Mantém a linha com funnel_id NOT NULL e product_description configurada;
--    fallback: a linha com menor ctid (a mais antiga).
-- ============================================================
DELETE FROM checkout_offers co
WHERE co.offer_type = 'order_bump'
  AND co.is_active = true
  AND co.id NOT IN (
    SELECT DISTINCT ON (checkout_id, product_id)
           id
    FROM checkout_offers
    WHERE offer_type = 'order_bump'
      AND is_active = true
      AND checkout_id IS NOT NULL
    ORDER BY
      checkout_id,
      product_id,
      -- Prefere linha com funnel_id preenchido
      (funnel_id IS NOT NULL) DESC,
      -- Prefere linha com product_description preenchida
      (product_description IS NOT NULL AND product_description != 'Add to purchase') DESC,
      -- Desempate: offer_position menor (mais específico)
      offer_position ASC NULLS LAST,
      -- Último desempate: mais recente (id maior como proxy)
      id DESC
  );

-- ============================================================
-- 2. Atualizar get_checkout_data_v2 para usar DISTINCT ON
-- ============================================================
CREATE OR REPLACE FUNCTION get_checkout_data_v2(p_short_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url       RECORD;
    v_checkout  RECORD;
    v_app       RECORD;
    v_mp        RECORD;
    v_offers    JSONB := '[]'::jsonb;
    v_success_url TEXT;
BEGIN
    -- 1. Resolve short URL → checkout_id + product ref
    SELECT checkout_id, member_area_id, application_id
    INTO v_url
    FROM checkout_urls
    WHERE id = p_short_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Checkout not found');
    END IF;

    -- 2. Get checkout row
    SELECT *
    INTO v_checkout
    FROM checkouts
    WHERE id = v_url.checkout_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Checkout not found');
    END IF;

    -- 3. Order bumps — DISTINCT ON product_id elimina duplicatas no banco;
    --    usa NULLIF para converter NaN em NULL, COALESCE para fallback.
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id',                  co.id,
                'product_id',          co.product_id,
                'offer_price',         NULLIF(co.offer_price, 'NaN'::numeric),
                'original_price',      NULLIF(co.original_price, 'NaN'::numeric),
                'offer_image',         co.offer_product_image,
                'button_text',         co.button_text,
                'offer_text',          co.offer_text,
                'product_name',        co.product_name,
                'product_description', co.product_description,
                'show_product_image',  co.show_product_image,
                'discount_percentage', co.discount_percentage,
                'currency',            co.currency,
                'offer_position',      co.offer_position
            ) ORDER BY co.offer_position ASC NULLS LAST
        ),
        '[]'::jsonb
    )
    INTO v_offers
    FROM (
        SELECT DISTINCT ON (co2.product_id) co2.*
        FROM checkout_offers co2
        WHERE co2.checkout_id = v_url.checkout_id
          AND co2.offer_type  = 'order_bump'
          AND co2.is_active   = true
        ORDER BY
          co2.product_id,
          (co2.funnel_id IS NOT NULL) DESC,
          (co2.product_description IS NOT NULL AND co2.product_description != 'Add to purchase') DESC,
          co2.offer_position ASC NULLS LAST
    ) co;

    -- 4. Redirect config — resolve post_purchase_redirect_url ou post_purchase_page_id→external_url
    SELECT COALESCE(
        fp.settings->>'post_purchase_redirect_url',
        (SELECT fp2.external_url
         FROM funnel_pages fp2
         WHERE fp2.id = (fp.settings->>'post_purchase_page_id')::uuid
         LIMIT 1)
    )
    INTO v_success_url
    FROM funnel_pages fp
    WHERE fp.checkout_id = v_url.checkout_id
    LIMIT 1;

    -- 5a. Application product
    IF v_url.application_id IS NOT NULL THEN
        SELECT *
        INTO v_app
        FROM applications
        WHERE id = v_url.application_id
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('error', 'Product not found');
        END IF;

        RETURN jsonb_build_object(
            'checkout', jsonb_build_object(
                'id',             v_checkout.id,
                'name',           v_checkout.name,
                'is_default',     v_checkout.is_default,
                'custom_price',   v_checkout.custom_price,
                'banner_image',   v_checkout.banner_image,
                'banner_title',   v_checkout.banner_title,
                'custom_height',  v_checkout.custom_height,
                'custom_width',   v_checkout.custom_width,
                'language',       COALESCE(v_checkout.language, 'en'),
                'application_id', v_checkout.application_id,
                'member_area_id', v_checkout.member_area_id,
                'custom_fields',  COALESCE(v_checkout.custom_fields, '{}'::jsonb),
                'created_at',     v_checkout.created_at
            ),
            'product', jsonb_build_object(
                'id',                     v_app.id,
                'name',                   v_app.name,
                'price',                  0,
                'currency',               UPPER(COALESCE(v_app.currency, 'USD')),
                'image_url',              v_app.logo_url,
                'description',            COALESCE(v_app.description, ''),
                'payment_methods',        to_jsonb(COALESCE(v_app.payment_methods, ARRAY['credit_card'])),
                'default_payment_method', COALESCE(v_app.default_payment_method, 'credit_card'),
                'dynamic_checkout',       COALESCE(v_app.dynamic_checkout, false),
                'applicationId',          v_app.id
            ),
            'productType',        'app',
            'offers',             COALESCE(v_offers, '[]'::jsonb),
            'applicationProducts','[]'::jsonb,
            'redirectConfig',     jsonb_build_object('success_url', v_success_url)
        );

    -- 5b. Marketplace product
    ELSE
        SELECT *
        INTO v_mp
        FROM marketplace_products
        WHERE id = v_url.member_area_id
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('error', 'Product not found');
        END IF;

        RETURN jsonb_build_object(
            'checkout', jsonb_build_object(
                'id',             v_checkout.id,
                'name',           v_checkout.name,
                'is_default',     v_checkout.is_default,
                'custom_price',   v_checkout.custom_price,
                'banner_image',   v_checkout.banner_image,
                'banner_title',   v_checkout.banner_title,
                'custom_height',  v_checkout.custom_height,
                'custom_width',   v_checkout.custom_width,
                'language',       COALESCE(v_checkout.language, 'en'),
                'application_id', v_checkout.application_id,
                'member_area_id', v_checkout.member_area_id,
                'custom_fields',  COALESCE(v_checkout.custom_fields, '{}'::jsonb),
                'created_at',     v_checkout.created_at
            ),
            'product', jsonb_build_object(
                'id',                     v_mp.id,
                'name',                   v_mp.name,
                'price',                  COALESCE(v_mp.price, 0),
                'currency',               UPPER(COALESCE(v_mp.currency, 'USD')),
                'image_url',              v_mp.image_url,
                'description',            COALESCE(v_mp.description, ''),
                'payment_methods',        to_jsonb(COALESCE(v_mp.payment_methods, ARRAY['credit_card'])),
                'default_payment_method', COALESCE(v_mp.default_payment_method, 'credit_card'),
                'dynamic_checkout',       COALESCE(v_mp.dynamic_checkout, false)
            ),
            'productType',        'marketplace',
            'offers',             COALESCE(v_offers, '[]'::jsonb),
            'applicationProducts','[]'::jsonb,
            'redirectConfig',     jsonb_build_object('success_url', v_success_url)
        );
    END IF;
END;
$$;

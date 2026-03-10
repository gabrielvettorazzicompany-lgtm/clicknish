-- Fix: checkout_offers com offer_price = NaN (gerado por bug no OrderBumpForm)
-- Substitui NaN pelo original_price (quando válido) ou pelo preço do checkout vinculado.

-- 1. Corrigir offer_price NaN usando original_price como fallback
UPDATE checkout_offers
SET offer_price = CASE
    WHEN original_price IS NOT NULL AND original_price != 'NaN'::numeric THEN original_price
    ELSE 0
END
WHERE offer_price = 'NaN'::numeric;

-- 2. Corrigir original_price NaN também
UPDATE checkout_offers
SET original_price = 0
WHERE original_price = 'NaN'::numeric;

-- 3. Atualizar get_checkout_data_v2 para incluir original_price no retorno das offers
--    e usar NULLIF para blindar contra futuros NaN no banco.
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

    -- 3. Order bumps — usa NULLIF para converter NaN em NULL, COALESCE para fallback
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id',                  co.id,
                'product_id',          co.product_id,
                -- Garante que NaN (numeric) vira NULL antes de ir para o JSON
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
    FROM checkout_offers co
    WHERE co.checkout_id = v_url.checkout_id
      AND co.offer_type  = 'order_bump'
      AND co.is_active   = true;

    -- 4. Redirect config (first matching funnel_page)
    SELECT fp.settings->>'success_url'
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

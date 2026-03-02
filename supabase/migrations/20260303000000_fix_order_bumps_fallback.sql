-- Fix: order bumps apareciam em checkouts sem configuração
--
-- Problema: o fallback por product_id buscava o funnel_id de QUALQUER funil
-- do mesmo produto, fazendo order bumps de um funil aparecerem em checkouts
-- que nunca tiveram order bumps configurados.
--
-- Correção: remover o fallback por product_id. O funil só é usado se o
-- próprio checkout faz parte dele (via funnel_pages).

CREATE OR REPLACE FUNCTION get_checkout_order_bumps_optimized(
    p_checkout_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
    offer_id UUID,
    product_id UUID,
    product_name TEXT,
    product_price DECIMAL,
    product_image TEXT,
    offer_price DECIMAL,
    offer_image TEXT,
    button_text TEXT,
    offer_text TEXT,
    product_description TEXT,
    show_product_image BOOLEAN,
    discount_percentage INTEGER,
    currency TEXT,
    offer_position INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_funnel_id UUID;
BEGIN
    -- Busca o funnel_id SOMENTE se esse checkout faz parte de um funil
    -- (via funnel_pages). Sem fallback por product_id para evitar que
    -- order bumps de outros checkouts/funis do mesmo produto apareçam aqui.
    IF p_checkout_id IS NOT NULL THEN
        SELECT fp.funnel_id INTO v_funnel_id
        FROM funnel_pages fp
        WHERE fp.checkout_id = p_checkout_id
        LIMIT 1;
    END IF;

    -- Se não encontrou funil para esse checkout, retorna vazio
    -- (order bumps só são buscados via checkout_id direto ou via funil vinculado)
    RETURN QUERY
    WITH offers AS (
        SELECT
            co.id as offer_id,
            co.product_id,
            co.offer_price,
            co.offer_product_image as offer_image,
            co.button_text,
            co.offer_text,
            co.product_name as stored_product_name,
            co.product_description,
            co.show_product_image,
            co.discount_percentage,
            co.currency,
            co.offer_position,
            co.original_price
        FROM checkout_offers co
        WHERE (
            co.checkout_id = p_checkout_id
            OR (v_funnel_id IS NOT NULL AND co.funnel_id = v_funnel_id)
        )
          AND co.offer_type = 'order_bump'
          AND co.is_active = true
        ORDER BY co.offer_position ASC NULLS LAST
    )
    SELECT
        o.offer_id,
        o.product_id,
        COALESCE(
            o.stored_product_name,
            mp.name,
            a.name,
            p.name,
            'Produto'
        )::TEXT as product_name,
        COALESCE(
            o.offer_price,
            o.original_price,
            mp.price,
            0::decimal
        ) as product_price,
        COALESCE(
            mp.image_url,
            a.logo_url,
            p.cover_url
        )::TEXT as product_image,
        o.offer_price,
        o.offer_image::TEXT as offer_image,
        o.button_text::TEXT as button_text,
        o.offer_text::TEXT as offer_text,
        o.product_description::TEXT as product_description,
        o.show_product_image,
        o.discount_percentage,
        COALESCE(o.currency, mp.currency, 'USD')::TEXT as currency,
        o.offer_position
    FROM offers o
    LEFT JOIN marketplace_products mp ON mp.id = o.product_id
    LEFT JOIN applications a ON a.id = o.product_id
    LEFT JOIN products p ON p.id = o.product_id
    WHERE (mp.id IS NOT NULL OR a.id IS NOT NULL OR p.id IS NOT NULL OR o.stored_product_name IS NOT NULL)
    ORDER BY o.offer_position ASC NULLS LAST;
END;
$$;

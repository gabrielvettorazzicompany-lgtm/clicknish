-- ✅ OTIMIZAÇÃO: RPC Function para carregar Order Bumps em UMA query
-- Esta função vai substituir as 10+ queries individuais por uma única query otimizada

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
    -- Primeiro, encontrar o funnel_id
    IF p_checkout_id IS NOT NULL THEN
        SELECT fp.funnel_id INTO v_funnel_id
        FROM funnel_pages fp 
        WHERE fp.checkout_id = p_checkout_id
        LIMIT 1;
    END IF;
    
    -- Fallback: buscar por product_id
    IF v_funnel_id IS NULL AND p_product_id IS NOT NULL THEN
        SELECT f.id INTO v_funnel_id
        FROM funnels f
        WHERE f.product_id = p_product_id
        LIMIT 1;
    END IF;
    
    -- Se não encontrou funnel, retornar vazio
    IF v_funnel_id IS NULL THEN
        RETURN;
    END IF;
    
    -- ✅ QUERY OTIMIZADA: Buscar tudo com JOINs em uma única operação
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
        WHERE (co.checkout_id = p_checkout_id OR co.funnel_id = v_funnel_id)
          AND co.offer_type = 'order_bump'
          AND co.is_active = true
        ORDER BY co.offer_position ASC NULLS LAST
    )
    SELECT 
        o.offer_id,
        o.product_id,
        -- Usar nome salvo na oferta ou buscar do produto
        COALESCE(
            o.stored_product_name,
            mp.name,
            a.name,
            p.name,
            'Produto'
        )::TEXT as product_name,
        -- Usar preço da oferta ou preço original do produto  
        COALESCE(
            o.offer_price,
            o.original_price,
            mp.price,
            0::decimal
        ) as product_price,
        -- Imagem do produto
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
    -- LEFT JOIN com todas as tabelas de produtos de uma vez
    LEFT JOIN marketplace_products mp ON mp.id = o.product_id
    LEFT JOIN applications a ON a.id = o.product_id  
    LEFT JOIN products p ON p.id = o.product_id
    -- Garantir que pelo menos um produto foi encontrado
    WHERE (mp.id IS NOT NULL OR a.id IS NOT NULL OR p.id IS NOT NULL OR o.stored_product_name IS NOT NULL)
    ORDER BY o.offer_position ASC NULLS LAST;
END;
$$;

-- ✅ ÍNDICES: Otimizar performance das queries
CREATE INDEX IF NOT EXISTS idx_checkout_offers_checkout_funnel 
ON checkout_offers(checkout_id, funnel_id, offer_type, is_active);

CREATE INDEX IF NOT EXISTS idx_funnel_pages_checkout 
ON funnel_pages(checkout_id, funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnels_product 
ON funnels(product_id);

-- ✅ COMENTÁRIOS: Documentar a otimização
COMMENT ON FUNCTION get_checkout_order_bumps_optimized IS 
'Função otimizada para carregar order bumps em uma única query. 
Reduz de 10+ queries para 1 query com JOINs otimizados.
Inclui fallbacks e cache-friendly design.';
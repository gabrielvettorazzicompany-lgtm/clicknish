CREATE OR REPLACE FUNCTION public.get_checkout_data_v2(
    p_short_id text DEFAULT NULL::text,
    p_checkout_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_checkout_id uuid;
    v_checkout_record record;
    v_product_record record;
    v_product_type text;
    v_offers json;
    v_redirect_config json;
    v_app_products json;
    v_result json;
BEGIN
    -- 1. Resolver o checkout_id a partir do short_id ou usar o direto
    IF p_short_id IS NOT NULL THEN
        SELECT checkout_id INTO v_checkout_id
        FROM checkout_urls 
        WHERE id = p_short_id;
        
        IF v_checkout_id IS NULL THEN
            RETURN json_build_object(
                'error', 'Checkout URL not found',
                'code', 'CHECKOUT_URL_NOT_FOUND'
            );
        END IF;
    ELSIF p_checkout_id IS NOT NULL THEN
        v_checkout_id = p_checkout_id;
    ELSE
        RETURN json_build_object(
            'error', 'Missing short_id or checkout_id',
            'code', 'MISSING_PARAMETERS'
        );
    END IF;

    -- 2. Buscar dados do checkout
    SELECT * INTO v_checkout_record
    FROM checkouts
    WHERE id = v_checkout_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'error', 'Checkout not found',
            'code', 'CHECKOUT_NOT_FOUND'
        );
    END IF;

    -- 3. Buscar dados do produto/aplicação baseado no checkout
    IF v_checkout_record.application_id IS NOT NULL THEN
        -- É uma aplicação
        SELECT 
            a.id,
            a.name,
            a.slug,
            a.user_id as owner_id,
            NULL::decimal as price,
            NULL::text as currency,
            a.image_url,
            a.description
        INTO v_product_record
        FROM applications a
        WHERE a.id = v_checkout_record.application_id;
        
        v_product_type = 'app';
        
    ELSIF v_checkout_record.member_area_id IS NOT NULL THEN
        -- É um produto marketplace - CORRIGIDO: usar marketplace_products ao invés de member_areas
        SELECT 
            m.id,
            m.name,
            m.slug,
            m.owner_id,
            m.price,
            m.currency,
            m.image_url,
            m.description
        INTO v_product_record
        FROM marketplace_products m
        WHERE m.id = v_checkout_record.member_area_id;
        
        -- CORRIGIDO: retornar 'marketplace' ao invés de 'member_area'
        v_product_type = 'marketplace';
        
    ELSE
        RETURN json_build_object(
            'error', 'Invalid checkout configuration',
            'code', 'INVALID_CHECKOUT'
        );
    END IF;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'error', 'Product not found',
            'code', 'PRODUCT_NOT_FOUND'
        );
    END IF;

    -- 4. Buscar offers/order bumps ativos
    SELECT json_agg(
        json_build_object(
            'id', co.id,
            'offer_price', co.offer_price,
            'original_price', co.original_price,
            'offer_product_id', co.offer_product_id,
            'offer_type', co.offer_type,
            'offer_position', co.offer_position
        )
    ) INTO v_offers
    FROM checkout_offers co
    WHERE co.checkout_id = v_checkout_id 
      AND co.is_active = true
      AND co.offer_type = 'order_bump';
    
    -- Se não há offers, defina como array vazio
    IF v_offers IS NULL THEN
        v_offers = '[]'::json;
    END IF;

    -- 5. Buscar configuração de redirecionamento
    -- Strategy 1: Verificar funnel_page vinculado diretamente ao checkout
    WITH funnel_redirect AS (
        SELECT 
            f.redirect_url_success as success_url,
            f.redirect_url_cancel as cancel_url
        FROM funnel_pages fp
        INNER JOIN funnels f ON f.id = fp.funnel_id
        WHERE fp.checkout_id = v_checkout_id
        LIMIT 1
    ),
    -- Strategy 2: Checkout dos settings do usuário
    user_redirect AS (
        SELECT 
            us.redirect_url_success as success_url,
            us.redirect_url_cancel as cancel_url
        FROM user_settings us
        WHERE us.user_id = v_product_record.owner_id
    )
    SELECT 
        COALESCE(fr.success_url, ur.success_url) as success_url,
        COALESCE(fr.cancel_url, ur.cancel_url) as cancel_url
    INTO v_redirect_config
    FROM funnel_redirect fr
    FULL OUTER JOIN user_redirect ur ON true
    LIMIT 1;
    
    -- Se redirect_config não encontrado, usar objeto vazio
    IF v_redirect_config IS NULL THEN
        v_redirect_config = json_build_object('success_url', null, 'cancel_url', null);
    ELSE
        v_redirect_config = json_build_object(
            'success_url', (v_redirect_config).success_url,
            'cancel_url', (v_redirect_config).cancel_url
        );
    END IF;

    -- 6. Se for aplicação, buscar produtos da aplicação
    IF v_product_type = 'app' THEN
        SELECT json_agg(
            json_build_object(
                'id', p.id,
                'name', p.name,
                'price', p.price,
                'currency', p.currency,
                'image_url', p.image_url,
                'description', p.description
            )
        ) INTO v_app_products
        FROM products p
        WHERE p.application_id = v_checkout_record.application_id;
    ELSE
        v_app_products = '[]'::json;
    END IF;

    -- Se não há produtos da app, defina como array vazio
    IF v_app_products IS NULL THEN
        v_app_products = '[]'::json;
    END IF;

    -- 7. Montar resultado final
    v_result = json_build_object(
        'error', null,
        'checkout', json_build_object(
            'id', v_checkout_record.id,
            'name', v_checkout_record.name,
            'member_area_id', v_checkout_record.member_area_id,
            'application_id', v_checkout_record.application_id,
            'is_default', v_checkout_record.is_default,
            'custom_price', v_checkout_record.custom_price,
            'banner_image', v_checkout_record.banner_image,
            'banner_title', v_checkout_record.banner_title,
            'custom_height', v_checkout_record.custom_height,
            'custom_fields', v_checkout_record.custom_fields,
            'created_at', v_checkout_record.created_at
        ),
        'product', json_build_object(
            'id', v_product_record.id,
            'name', v_product_record.name,
            'slug', v_product_record.slug,
            'price', v_product_record.price,
            'currency', COALESCE(v_product_record.currency, 'BRL'),
            'image_url', v_product_record.image_url,
            'description', v_product_record.description,
            'owner_id', v_product_record.owner_id,
            'applicationId', CASE WHEN v_product_type = 'app' THEN v_checkout_record.application_id ELSE NULL END
        ),
        'productType', v_product_type,
        'offers', v_offers,
        'redirectConfig', v_redirect_config,
        'applicationProducts', v_app_products
    );

    RETURN v_result;
END;
$function$;
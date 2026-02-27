-- ✅ FUNÇÃO: Identificar checkouts quentes para pré-aquecimento
-- Analisa padrões de tráfego e retorna checkouts que devem ser mantidos sempre em cache

CREATE OR REPLACE FUNCTION get_hot_checkouts(
    hours_back INTEGER DEFAULT 2,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
    short_id TEXT,
    visit_count BIGINT,
    conversion_rate DECIMAL,
    last_access TIMESTAMPTZ,
    priority_score DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Buscar checkouts mais acessados com base em analytics
    RETURN QUERY
    WITH checkout_visits AS (
        SELECT 
            c.short_id,
            COUNT(DISTINCT ca.session_id) as unique_visits,
            COUNT(*) as total_events,
            MAX(ca.created_at) as last_visit,
            SUM(CASE WHEN ca.event_type = 'conversion' THEN 1 ELSE 0 END) as conversions
        FROM checkouts c
        LEFT JOIN checkout_analytics ca ON ca.checkout_id = c.id
        WHERE ca.created_at >= NOW() - INTERVAL '1 hour' * hours_back
        GROUP BY c.short_id, c.id
        HAVING COUNT(*) > 0
    ),
    enriched_data AS (
        SELECT 
            cv.short_id,
            cv.unique_visits as visit_count,
            CASE 
                WHEN cv.unique_visits > 0 
                THEN ROUND((cv.conversions::decimal / cv.unique_visits) * 100, 2)
                ELSE 0 
            END as conversion_rate,
            cv.last_visit as last_access,
            -- Score de prioridade: visits * conversion_rate * recency_factor
            ROUND(
                cv.unique_visits * 
                (CASE WHEN cv.unique_visits > 0 THEN cv.conversions::decimal / cv.unique_visits ELSE 0 END) *
                (CASE 
                    WHEN cv.last_visit >= NOW() - INTERVAL '30 minutes' THEN 2.0
                    WHEN cv.last_visit >= NOW() - INTERVAL '1 hour' THEN 1.5
                    ELSE 1.0
                END), 
                2
            ) as priority_score
        FROM checkout_visits cv
    )
    SELECT 
        ed.short_id,
        ed.visit_count,
        ed.conversion_rate,
        ed.last_access,
        ed.priority_score
    FROM enriched_data ed
    WHERE ed.visit_count >= 2  -- Mínimo 2 visitantes únicos
    ORDER BY ed.priority_score DESC, ed.visit_count DESC
    LIMIT limit_count;
END;
$$;

-- ✅ TABELA: Analytics do sistema de preloader
CREATE TABLE IF NOT EXISTS cache_preloader_stats (
    id SERIAL PRIMARY KEY,
    total_processed INTEGER NOT NULL,
    already_warm INTEGER NOT NULL,
    newly_warmed INTEGER NOT NULL,
    errors INTEGER NOT NULL,
    avg_duration INTEGER NOT NULL,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ✅ ÍNDICE: Otimizar queries de analytics
CREATE INDEX IF NOT EXISTS idx_checkout_analytics_recent 
ON checkout_analytics(created_at DESC, checkout_id, event_type);

-- ✅ VIEW: Dashboard de performance do cache
CREATE OR REPLACE VIEW cache_performance_dashboard AS
SELECT 
    DATE_TRUNC('hour', run_timestamp) as hour_bucket,
    AVG(total_processed) as avg_processed,
    AVG(newly_warmed) as avg_warmed,
    AVG(errors) as avg_errors,
    AVG(avg_duration) as avg_response_time,
    COUNT(*) as runs_count,
    SUM(newly_warmed)::decimal / NULLIF(SUM(total_processed), 0) * 100 as cache_miss_rate
FROM cache_preloader_stats
WHERE run_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;

COMMENT ON FUNCTION get_hot_checkouts IS 'Identifica checkouts quentes baseado em tráfego, conversões e recência para pré-aquecimento inteligente';
COMMENT ON TABLE cache_preloader_stats IS 'Métricas de performance do sistema de pré-aquecimento de cache';
COMMENT ON VIEW cache_performance_dashboard IS 'Dashboard de performance do cache em tempo real';
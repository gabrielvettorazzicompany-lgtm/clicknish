-- ============================================================
-- Script AGRESSIVO para deletar mais usuários órfãos da auth.users
-- Use com cuidado! Testje primeiro com DRY RUN
-- ============================================================

-- 1. DIAGNÓSTICO: Ver quantos usuários órfãos existem
SELECT 
    'auth_users_total' as tipo,
    COUNT(*) as total
FROM auth.users
UNION ALL
SELECT 
    'admins' as tipo,
    COUNT(DISTINCT ap.user_id) as total
FROM public.admin_profiles ap
UNION ALL  
SELECT 
    'vendors_com_apps' as tipo,
    COUNT(DISTINCT apps.owner_id) as total
FROM public.applications apps
UNION ALL
SELECT 
    'vendors_com_member_areas' as tipo,
    COUNT(DISTINCT ma.owner_id) as total
FROM public.member_areas ma
UNION ALL
SELECT 
    'migrados_para_customer_auth' as tipo,
    COUNT(DISTINCT ca.email) as total
FROM public.customer_auth ca
UNION ALL
SELECT 
    'orfaos_candidatos_a_delecao' as tipo,
    COUNT(*) as total
FROM auth.users au
LEFT JOIN public.admin_profiles ap ON ap.user_id = au.id
LEFT JOIN public.applications apps ON apps.owner_id = au.id  
LEFT JOIN public.member_areas ma ON ma.owner_id = au.id
WHERE ap.user_id IS NULL       -- Não é admin
  AND apps.owner_id IS NULL    -- Não tem apps
  AND ma.owner_id IS NULL      -- Não tem member areas
  AND (
    au.last_sign_in_at IS NULL OR                                    -- Nunca fez login
    au.last_sign_in_at < now() - INTERVAL '30 days' OR              -- Login há mais de 30 dias
    EXISTS (SELECT 1 FROM public.customer_auth ca WHERE ca.email = LOWER(au.email))  -- Migrado
  );

-- ============================================================
-- 2. SCRIPT DE DELEÇÃO AGRESSIVA (DESCOMENTE PARA USAR)
-- ============================================================

/*
DO $$
DECLARE
    orphan_record RECORD;
    cleanup_count INTEGER := 0;
    dry_run BOOLEAN := true;  -- MUDE PARA false PARA EXECUTAR DE VERDADE
BEGIN
    RAISE NOTICE 'Iniciando cleanup AGRESSIVO de usuários órfãos...';
    RAISE NOTICE 'DRY RUN: %', dry_run;

    -- Critérios mais agressivos para deleção
    FOR orphan_record IN 
        SELECT DISTINCT au.id, au.email, au.created_at, au.last_sign_in_at
        FROM auth.users au
        LEFT JOIN public.admin_profiles ap ON ap.user_id = au.id
        LEFT JOIN public.applications apps ON apps.owner_id = au.id  
        LEFT JOIN public.member_areas ma ON ma.owner_id = au.id
        WHERE ap.user_id IS NULL       -- Não é admin
          AND apps.owner_id IS NULL    -- Não tem apps
          AND ma.owner_id IS NULL      -- Não tem member areas
          AND au.email IS NOT NULL
          AND au.email NOT LIKE '%@company.com'  -- Proteger emails corporativos
          AND (
            au.last_sign_in_at IS NULL OR                                    -- Nunca fez login
            au.last_sign_in_at < now() - INTERVAL '7 days' OR               -- Login há mais de 7 dias
            EXISTS (SELECT 1 FROM public.customer_auth ca WHERE ca.email = LOWER(au.email))  -- Migrado
          )
    LOOP
        BEGIN
            RAISE NOTICE 'Processando órfão: % (ID: %, último login: %)', 
                orphan_record.email, orphan_record.id, orphan_record.last_sign_in_at;

            IF NOT dry_run THEN
                -- Deletar registros relacionados primeiro
                DELETE FROM public.password_reset_tokens WHERE user_id = orphan_record.id;
                DELETE FROM public.withdrawal_requests WHERE user_id = orphan_record.id;
                DELETE FROM public.anticipation_requests WHERE user_id = orphan_record.id;
                DELETE FROM public.financial_reserves WHERE user_id = orphan_record.id;
                DELETE FROM public.payout_plan_requests WHERE user_id = orphan_record.id;
                
                -- SET NULL para campos opcionais
                UPDATE public.global_announcements SET updated_by = NULL WHERE updated_by = orphan_record.id;
                UPDATE public.admin_settings SET updated_by = NULL WHERE updated_by = orphan_record.id;
                UPDATE public.audit_logs SET created_by = NULL WHERE created_by = orphan_record.id;
                UPDATE public.mollie_payment_methods SET seller_id = NULL WHERE seller_id = orphan_record.id;
                UPDATE public.refund_requests SET reviewed_by = NULL WHERE reviewed_by = orphan_record.id;
                
                -- Deletar da auth.users
                DELETE FROM auth.users WHERE id = orphan_record.id;
                
                RAISE NOTICE '✅ Usuário deletado: %', orphan_record.email;
            ELSE
                RAISE NOTICE '🔍 [DRY RUN] Seria deletado: %', orphan_record.email;
            END IF;
            
            cleanup_count := cleanup_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Erro ao deletar %: %', orphan_record.email, SQLERRM;
        END;
    END LOOP;
    
    IF dry_run THEN
        RAISE NOTICE '🔍 DRY RUN concluído. % usuários seriam deletados', cleanup_count;
        RAISE NOTICE '⚠️  Para executar de verdade, mude dry_run para false';
    ELSE
        RAISE NOTICE '✅ Cleanup concluído. % usuários órfãos removidos', cleanup_count;
    END IF;
END $$;
*/

-- ============================================================
-- 3. QUERY PARA VER DETALHES DOS CANDIDATOS A DELEÇÃO
-- ============================================================

SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    CASE 
        WHEN au.last_sign_in_at IS NULL THEN 'nunca_logou'
        WHEN au.last_sign_in_at < now() - INTERVAL '30 days' THEN 'inativo_30d'
        WHEN au.last_sign_in_at < now() - INTERVAL '7 days' THEN 'inativo_7d'
        ELSE 'ativo_recente'
    END as status_atividade,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.customer_auth ca WHERE ca.email = LOWER(au.email)) 
        THEN 'migrado_customer_auth' 
        ELSE 'nao_migrado' 
    END as status_migracao,
    (SELECT COUNT(*) FROM public.app_users WHERE user_id = au.id) as app_users_count,
    (SELECT COUNT(*) FROM public.member_profiles WHERE user_id = au.id) as member_profiles_count
FROM auth.users au
LEFT JOIN public.admin_profiles ap ON ap.user_id = au.id
LEFT JOIN public.applications apps ON apps.owner_id = au.id  
LEFT JOIN public.member_areas ma ON ma.owner_id = au.id
WHERE ap.user_id IS NULL       -- Não é admin
  AND apps.owner_id IS NULL    -- Não tem apps
  AND ma.owner_id IS NULL      -- Não tem member areas
  AND au.email IS NOT NULL
ORDER BY au.last_sign_in_at DESC NULLS LAST;
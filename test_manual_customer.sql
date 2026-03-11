-- Script para testar criação manual de customer
-- Cria o registro que deveria ter sido criado pelo createCustomerUser()

INSERT INTO customer_auth (
    id,
    email, 
    password_hash, 
    jwt_secret, 
    created_at
) VALUES (
    (SELECT user_id FROM app_users WHERE email = 'gabrielvettorazzii@gmail.com'),
    'gabrielvettorazzii@gmail.com',
    'pbkdf2_placeholder_hash_' || encode(sha256('derived_gabrielvettorazzii@gmail.com_test_key'::bytea), 'hex'),
    'jwt_secret_' || extract(epoch from now()),
    now()
) ON CONFLICT (email) DO NOTHING;

-- Verificar se foi criado
SELECT id, email, created_at 
FROM customer_auth 
ORDER BY created_at DESC 
LIMIT 3;
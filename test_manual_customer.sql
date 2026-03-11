-- Deletar o registro com hash inválido e deixar o worker recriar corretamente
DELETE FROM customer_auth WHERE email = 'gabrielvettorazzii@gmail.com';

-- Confirmar deleção
SELECT id, email FROM customer_auth WHERE email = 'gabrielvettorazzii@gmail.com';
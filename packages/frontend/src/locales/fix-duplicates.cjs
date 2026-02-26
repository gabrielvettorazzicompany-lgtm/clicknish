const fs = require('fs');

function fixFile(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');

    // Encontrar índices das duas seções funnel_components
    let firstStart = -1, firstEnd = -1, secondStart = -1, secondEnd = -1;
    let braceCount = 0;
    let inFunnelComponents = false;
    let foundFirst = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('"funnel_components":')) {
            if (!foundFirst) {
                firstStart = i;
                inFunnelComponents = true;
                braceCount = 0;
                foundFirst = true;
            } else {
                secondStart = i;
                inFunnelComponents = true;
                braceCount = 0;
            }
        }

        if (inFunnelComponents) {
            braceCount += (line.match(/{/g) || []).length;
            braceCount -= (line.match(/}/g) || []).length;

            if (braceCount === 0 && line.includes('}')) {
                if (firstEnd === -1) {
                    firstEnd = i;
                    inFunnelComponents = false;
                } else if (secondStart !== -1) {
                    secondEnd = i;
                    inFunnelComponents = false;
                }
            }
        }
    }

    console.log(`${filename}: first=${firstStart}-${firstEnd}, second=${secondStart}-${secondEnd}`);

    // Extrair conteúdo interno da segunda seção (sem "funnel_components": { e sem o } final)
    const secondInnerLines = lines.slice(secondStart + 1, secondEnd);
    const flatKeysContent = secondInnerLines.join('\n');

    const newLines = [];

    // Copiar até firstEnd-1, adicionando vírgula na última linha se necessário
    for (let i = 0; i < firstEnd; i++) {
        let line = lines[i];
        if (i === firstEnd - 1) {
            if (line.trim() === '}') {
                line = line.replace(/}(\s*)$/, '},$1');
            }
        }
        newLines.push(line);
    }

    // Adicionar as chaves flat da segunda seção
    newLines.push(flatKeysContent);

    // Adicionar o fechamento de funnel_components (linha firstEnd com vírgula porque não é a última seção)
    newLines.push(lines[firstEnd]);

    // Copiar do firstEnd+1 até secondStart-1 (tudo entre as duas seções)
    const isSecondLast = secondEnd >= lines.length - 2; // última ou penúltima linha

    for (let i = firstEnd + 1; i < secondStart; i++) {
        let line = lines[i];
        // Se esta é a última linha antes do segundo funnel_components e o segundo é o último
        // Remover a vírgula trailing se existir
        if (i === secondStart - 1 && isSecondLast) {
            if (line.trim() === '},') {
                line = line.replace('},', '}');
            }
        }
        newLines.push(line);
    }

    // Pular a segunda seção funnel_components inteira (secondStart até secondEnd)
    // Continuar do secondEnd+1 até o fim (provavelmente só "}")
    for (let i = secondEnd + 1; i < lines.length; i++) {
        newLines.push(lines[i]);
    }

    // Escrever o arquivo corrigido
    const result = newLines.join('\n');
    fs.writeFileSync(filename, result);
    console.log(`${filename} corrigido!`);

    // Validar JSON
    try {
        JSON.parse(result);
        console.log(`${filename} JSON válido!`);
    } catch (e) {
        console.error(`${filename} JSON INVÁLIDO: ${e.message}`);
        const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || 0);
        console.error(`Contexto: ...${result.substring(pos - 50, pos)}<<<ERRO>>>${result.substring(pos, pos + 50)}...`);
    }
}

fixFile('pt.json');
fixFile('en.json');
fixFile('es.json');

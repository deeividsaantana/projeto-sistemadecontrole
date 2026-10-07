# Validação técnica V7

Data: 13/07/2026

## Verificações concluídas

- TypeScript: zero erros semânticos nos arquivos alterados.
- Sintaxe das duas funções Netlify: aprovada.
- Função de análise documental: resposta 405 para método indevido e 401 para sessão ausente.
- Regras de combustível: 12 de 12 cenários aprovados, incluindo macro de hora, data impossível, prefixo ambíguo, bomba divergente, regressão de horímetro, sequência e preservação do valor original.
- Firestore: alertas serializados sem campos `undefined` e registros divididos em blocos abaixo do limite por documento.
- Legado SGE: 9.408 linhas de HP, 3.507 de HT e 1.243 de produção preservadas; quatro jornadas órfãs foram reconstruídas e identificadas.
- Planilhas de combustível encontradas em `Downloads`: cabeçalhos, datas Excel, horas, leituras, bomba, litros, comboio, combustível e empresa auditados.
- Espelhamento: todos os 61 arquivos da versão principal conferidos por SHA-256 na cópia de publicação.
- Pacotes ZIP: conteúdo carregado novamente com validação CRC32.

## Conferências necessárias após publicar

- Validar a leitura local com um documento real e conferir manualmente os registros antes da gravação.
- Executar `npm install` e `npm run build` no Codespace ou ambiente de publicação.
- Conferir visualmente desktop e celular no endereço publicado.

O build e a captura automática do navegador não puderam ser executados neste computador porque a política do Windows bloqueia novos processos. A checagem semântica foi feita diretamente pelo compilador TypeScript, sem esconder essa limitação.

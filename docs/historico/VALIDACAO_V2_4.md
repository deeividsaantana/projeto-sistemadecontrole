# Validação — ERP v2.4

## Testes direcionados

- competência por data real;
- custo por litro e custo total;
- capacidade e percentual de tanque;
- excesso de capacidade enviado para revisão;
- alertas originais preservados;
- sequência cronológica por comboio;
- sugestão de bomba pelo último lançamento gravado;
- contrato do gateway e migration Supabase.

## Reconciliação com as planilhas mensais

| Arquivo | Linhas operacionais | Datas reais | Litros | Observações |
| --- | ---: | --- | ---: | --- |
| Junho/2026 | 1.155 | 21/05 a 20/06 | 118.318 | 449 linhas em maio e 706 em junho |
| Julho/2026 | 994 | 21/06 a 20/07 | 110.799 | 273 linhas em junho e 721 em julho |
| Agosto/2026 | 383 | 21/04 a 30/07 | 41.009 | 39 prefixos não cadastrados e duas linhas com erro de bomba |

Os números foram apurados diretamente das células operacionais. Linhas preenchidas somente por fórmulas copiadas não foram tratadas como abastecimento.

## Cenários de segurança

- nenhuma linha é filtrada antes de `onImportAbastecimentos`;
- registros desconhecidos permanecem com `prefixoInformado`;
- duplicidades permanecem na base com alerta;
- custo ausente permanece zero, sem estimativa artificial;
- competência inválida permanece vazia, sem usar o nome do arquivo;
- reset seletivo em modo `clear` continua persistindo array vazio;
- staging Supabase preserva cada linha antes de criar a revisão;
- staging não insere em `fueling_events`.

## Verificações estáticas executadas

- 105 arquivos TypeScript/TSX/JavaScript enumerados;
- 104 arquivos executáveis transpilados sem erro de sintaxe;
- uma declaração `.d.ts` não emitida pela API de transpile, como esperado;
- quatro arquivos do núcleo de domínio verificados sem erro de tipo;
- nenhuma importação relativa ausente;
- oito verificações direcionadas de domínio, bomba, schema e gateway aprovadas;
- contrato preservador executado com duas linhas distintas, mantendo ambas;
- quatro migrations com `begin`, `commit` e delimitadores SQL balanceados;
- nenhuma migration contém `DROP TABLE` ou `TRUNCATE`;
- 38 chaves literais de armazenamento, exatamente as mesmas da v2.3;
- 162 arquivos no pacote: sete novos, 18 alterados e nenhum removido.

## Homologação recomendada

1. Aplicar as migrations v2.1, v2.2, v2.3 e v2.4 em ordem.
2. Conferir capacidade de tanque dos equipamentos mais utilizados.
3. Importar junho, julho e agosto em lotes separados.
4. Comparar os totais por competência real, não pelo nome do arquivo.
5. Revisar os 39 prefixos não cadastrados de agosto.
6. Corrigir ou justificar as duas primeiras leituras de bomba de agosto.
7. Conferir divergências de continuidade por comboio.
8. Informar custo por litro somente com documento de referência.
9. Preservar um lote no Supabase e validar `fuel_review_items`.
10. Não promover registros canônicos antes da aprovação operacional.

## Limite local

O build Vite completo depende da instalação das dependências do projeto. O runner `node:test` tentou abrir subprocessos e recebeu `spawn EPERM`; por isso as oito verificações direcionadas foram executadas no processo Node atual. O build completo e `npm test` devem ser repetidos no ambiente de homologação após `npm install`.

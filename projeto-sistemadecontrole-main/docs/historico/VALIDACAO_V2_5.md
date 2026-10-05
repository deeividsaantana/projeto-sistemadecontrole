# Validação — ERP v2.5

## Reconciliação com a planilha

| Métrica | Leitura integral |
| --- | ---: |
| Liberações | 256 |
| Recebimentos | 287 |
| Números únicos | 309 |
| Pares por Ticket Nº | 234 |
| Liberações sem recebimento | 22 |
| Recebimentos sem liberação | 53 |
| Pares sem diferença nos quatro campos | 131 |
| Pares com divergência | 103 |
| Divergência de prefixo | 101 |
| Divergência de placa | 101 |
| Divergência de material | 0 |
| Divergência de quantidade | 0 |
| Duração média calculável | 334 minutos |

## Regras verificadas

- pareamento por número normalizado;
- nenhuma via avulsa descartada;
- duplicidade separada por liberação e recebimento;
- comparação de prefixo, placa, material e quantidade;
- cálculo de duração com virada de meia-noite;
- eventos de impressão e devolução;
- vínculo opcional com quatro cadastros mestres;
- staging preservador e sem promoção automática.

## Problemas da planilha cobertos

- os intervalos não são limitados às linhas 270 ou 431;
- referências `#REF!` não são reproduzidas;
- os indicadores usam o mesmo conjunto integral da fila;
- divergências são calculadas simetricamente;
- status manual e conferência automática permanecem conceitos separados.

## Cenários de segurança

- linha incompleta vira rascunho/revisão;
- possível duplicidade permanece na base;
- recebimento sem liberação permanece visível;
- liberação sem recebimento permanece visível;
- cadastro mestre ausente não bloqueia lançamento;
- falha na fila Supabase não desfaz a importação local;
- `stage_travel_import` não insere em `travel_tickets`;
- backup e Firebase continuam transportando o array completo.

## Verificações locais executadas

- 107 arquivos TypeScript, TSX, JavaScript e MJS transpilados sem erro de sintaxe;
- quatro arquivos do núcleo de viagens verificados sem erro de tipo;
- quatro cenários funcionais de pareamento, divergência, duplicidade e virada de meia-noite aprovados;
- 543 linhas operacionais da planilha reconciliadas com os totais esperados;
- nenhuma importação relativa ausente;
- cinco migrations com `begin`, `commit` e delimitadores SQL balanceados;
- nenhuma migration contém `DROP TABLE` ou `TRUNCATE`;
- 35 chaves literais de armazenamento, exatamente as mesmas da v2.4;
- 169 arquivos no pacote: sete novos, 14 alterados e nenhum removido.

## Homologação recomendada

1. Aplicar as migrations v2.1 a v2.5 em ordem.
2. Importar a planilha de viagens em ambiente de homologação.
3. Confirmar os 256 lançamentos de liberação e 287 de recebimento.
4. Revisar os 53 recebimentos sem liberação.
5. Revisar as 22 liberações sem recebimento.
6. Conferir os 103 pares divergentes.
7. Associar variações de ramo e destino aos cadastros mestres.
8. Validar as durações acima de um turno operacional.
9. Gerar um lote impresso e devolver as duas vias.
10. Exportar Excel e conferir as cinco abas.
11. Validar a fila `travel_review_items`.
12. Promover registros canônicos somente após aprovação operacional.

## Limite local

O build Vite completo depende das dependências instaladas. Quando o runner de testes não puder abrir subprocessos no Windows, as verificações direcionadas devem ser executadas no processo Node atual e o build completo repetido na homologação.

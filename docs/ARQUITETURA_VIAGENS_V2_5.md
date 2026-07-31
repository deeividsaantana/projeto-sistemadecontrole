# Arquitetura de Viagens — ERP v2.5

## Fonte única de verdade

O array existente `ticketsJazida` continua sendo a fonte operacional das telas, `localStorage`, backup e Firebase. A v2.5 não cria uma coleção local concorrente e mantém a chave `renea_tickets_jazida`.

Os novos vínculos `equipamentoId`, `materialId`, `localOrigemId`, `localDestinoId` e `ramoId` são opcionais. O texto operacional continua preservado quando um cadastro mestre ainda não pode ser resolvido.

## Planilhas examinadas

### VIAGENS JAZIDA SABESP.xlsx

| Aba | Finalidade | Registros e regras |
| --- | --- | --- |
| `LIBERAÇÃO` | saída da carga da jazida | 256 liberações; data, ticket, prefixo, placa, hora, material, quantidade e destino |
| `RECEBIMENTO` | chegada e descarga na obra | 287 recebimentos; acrescenta ramo, estaca, status manual e conferência automática |
| `CADASTRO` | cadastro auxiliar de frota | aba oculta com 33 pares de prefixo e placa |
| `CONTROLE TICKETS` | sequência física impressa | situação `DISPONÍVEL`, `IMPRESSO`, `UTILIZADO` ou `CANCELADO` |
| `INDICADORES` | resumo operacional | pares, pendências, divergências, duplicidades, volume, duração e situação dos impressos |

A planilha `CONTROLE DE VIAGEMS JAZIDA SABESP.xlsx`, citada como referência, não estava mais disponível no caminho informado durante esta etapa. Nenhuma regra foi presumida a partir de um arquivo ausente.

## Regras convertidas

1. O `Ticket Nº` é a chave de pareamento entre liberação e recebimento.
2. Duplicidade é verificada separadamente por tipo de via.
3. Um recebimento sem liberação continua visível.
4. Uma liberação sem recebimento continua visível.
5. A conferência compara prefixo, placa, material e quantidade.
6. Divergências não alteram nem descartam os valores originais.
7. A duração usa data/hora de saída e data/hora de chegada.
8. Quando os dois eventos têm a mesma data e a chegada é menor que a saída, o cálculo considera virada de meia-noite.
9. Impressão, liberação, recebimento e devolução são tratados como eventos operacionais.
10. Lotes impressos permanecem ligados aos números gerados.

## Relações encontradas

- `LIBERAÇÃO.C` ↔ `RECEBIMENTO.C`: número do ticket;
- `LIBERAÇÃO.D/E/G/H` ↔ `RECEBIMENTO.D/E/G/H`: conferência dos quatro campos;
- `CADASTRO.A/B`: prefixo ↔ placa;
- `CONTROLE TICKETS.A` ↔ tickets das duas abas: utilização da sequência física;
- `RECEBIMENTO.I/J`: ramo de descarga e estaca;
- cadastros mestres do sistema: equipamento, material, obra/local e ramo.

Na base examinada, a leitura integral encontrou 234 pares, 22 liberações sem recebimento e 53 recebimentos sem liberação. Entre os pares, 103 exigem revisão pela regra simétrica dos quatro campos.

## Problemas identificados

- fórmulas de `LIBERAÇÃO` consultam somente `RECEBIMENTO!C5:C270`, embora a aba contenha 287 recebimentos;
- 19 liberações pareadas aparecem como `SEM RECEBIMENTO` por causa do limite fixo da fórmula;
- indicadores de viagens completas, liberações pendentes e tempo médio estão com referências `#REF!`;
- as duas direções da conferência usam intervalos diferentes e podem produzir totais divergentes;
- o cadastro oculto duplica prefixo e placa já existentes no cadastro mestre do sistema;
- ramo, destino e estaca são textos livres com variações de grafia;
- o status manual `CONFERIDO` não garante que a conferência automática esteja sem divergências;
- duração e eventos não formam uma linha do tempo estruturada.

## Transformação em módulo

### Tela operacional

- mantém abas explícitas de `Liberação` e `Recebimento`;
- adiciona painel único de pareamento e fila de revisão;
- mostra duração, pendências, divergências e duplicidades;
- resolve IDs mestres sem impedir lançamentos ainda não vinculados;
- mantém impressão em branco, sequência, devolução e notas.

### Exportação

O Excel passa a incluir:

- `LIBERAÇÃO`;
- `RECEBIMENTO`;
- `CONFERÊNCIA VIAGENS`;
- `CONTROLE TICKETS`;
- `INDICADORES`.

Os cálculos são exportados como valores auditáveis e não dependem de intervalos fixos.

### Persistência gradual

O Supabase recebe:

- `travel_tickets`: entidade canônica;
- `travel_ticket_events`: eventos de liberação, recebimento, devolução, impressão e cancelamento;
- `travel_print_batches` e `travel_print_batch_items`: lotes e numeração;
- `travel_divergences`: diferenças estruturadas;
- `travel_review_items`: fila preservadora de importação;
- `travel_operation_overview`: pareamento e duração.

`stage_travel_import` preserva primeiro cada linha em `import_rows` e abre a revisão. A RPC não insere automaticamente em `travel_tickets`.

## Compatibilidade e impacto

- `TicketsJazidaTab` continua sendo a tela oficial;
- `TicketLinkExterno` e as rotas públicas permanecem ativos;
- backup, exportação geral, importação geral, reset e Firebase continuam usando `ticketsJazida`;
- os campos novos são opcionais para todo o histórico existente;
- nenhuma chave de armazenamento foi criada;
- nenhuma via é removida automaticamente por duplicidade, divergência ou ausência de cadastro.

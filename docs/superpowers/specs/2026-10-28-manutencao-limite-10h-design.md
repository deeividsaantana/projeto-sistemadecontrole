# Manutenção: linha do tempo, limite de 10 h e conferência

Data: 28/10/2026. Aprovado em conversa com o Deivid, parte por parte.

## Problema

- A hora parada de uma OS conta da abertura até agora (`calcularHorasParadas`
  em `src/utils/manutencao.ts`). OS sem liberação acumula sem fim: em 28/10
  havia 36 OS abertas, várias de dias anteriores.
- O controle diário da frota guarda uma única entrada e uma única liberação por
  dia (`horaEntradaManutencao`, `horaLiberacao`), mas no campo o equipamento
  entra e sai mais de uma vez.
- Relatório e conferência não mostram de onde vem cada hora parada.

## Decisões

1. Limite de **10 h paradas por dia**, por equipamento. Cada dia recomeça.
2. Descontos fixos, só na parte que cai dentro do período parado:
   - DDS, código 15: 07:00 às 07:15.
   - Almoço, código 13: 12:00 às 13:00.
3. Várias entradas e liberações no mesmo dia. As horas do dia são a soma dos
   períodos, depois dos descontos, até 10 h.
4. Fluxo: lançou "Em manutenção" → a OS abre sozinha (como já é hoje). Sem
   liberação até completar 10 h → a OS fecha sozinha, marcada "Encerrada pelo
   limite de 10 h", e o equipamento entra na conferência.
5. O administrador edita qualquer dia a qualquer momento, inclusive depois de
   conferido. Toda edição vai para o histórico com o valor antes e depois.
6. Entrada e liberação podem ser lançadas pela Frota (Controle e Quadro) e pela
   Manutenção. Fonte única: os eventos do controle diário.

## Abordagem

Linha do tempo de eventos como fonte única (opção 1). Não há tabela nova.

- Eventos: `ControleEquipamentoDiario.eventos` (`ENTRADA_MANUTENCAO`,
  `LIBERACAO_MANUTENCAO`, `SAIDA_OPERACAO`, `ALTERACAO_STATUS`), cada um com
  hora e responsável. Os campos `horaEntradaManutencao` e `horaLiberacao`
  continuam preenchidos com o primeiro e o último evento do dia, para as telas
  e relatórios que ainda os leem.
- Um módulo puro calcula o dia: `src/utils/horasParadasDoDia.ts`.
- Manutenção, Frota, relatório e conferência usam o mesmo módulo.

## Regra de cálculo (`horasParadasDoDia`)

Entrada: eventos de um equipamento num dia, a data do dia e "agora".

1. Monta os períodos: de cada entrada até a liberação seguinte.
   - Sem liberação: até agora (se o dia é hoje) ou até o fim do dia (dia
     passado).
   - Equipamento que vem parado do dia anterior, marcado "continua parado
     amanhã": o período começa às 07:00.
2. Desconta DDS e almoço na parte sobreposta a cada período.
3. Soma os períodos.
4. Passou de 10 h: o dia fica com 10 h e a situação é `LIMITE_ATINGIDO`.

Saída: períodos (início, fim ou aberto, descontos, líquido), total do dia,
situação (`LIBERADO`, `PARADO`, `LIMITE_ATINGIDO`, `INCONSISTENTE`) e a hora
em que o limite foi atingido, quando houver.

Dado errado (liberação antes da entrada, hora em branco ou inválida): não
inventa número. A situação é `INCONSISTENTE` e o equipamento vai para a
conferência.

Exemplos que viram teste:

| Eventos | Resultado |
|---|---|
| entrada 07:00, liberação 14:00 | 5 h 45 (7 h − 0,25 − 1) |
| entrada 07:30, liberação 10:00 | 2 h 30 |
| entrada 10:00, sem liberação, agora 15:00 | 4 h, `PARADO` |
| entrada 07:00, sem liberação, dia passado | 10 h, `LIMITE_ATINGIDO` |
| 09:30–11:00 e 14:00–16:00 | 3 h 30 |
| liberação 08:00 antes da entrada 09:00 | `INCONSISTENTE` |

## Fechamento automático da OS

Não há servidor rodando sozinho. O primeiro aparelho com o ERP aberto que
calcular `LIMITE_ATINGIDO` para uma OS aberta grava o fechamento:
`status: 'Concluída'`, `dataConclusao`/`horaConclusao` iguais à hora em que o
limite foi atingido e `observacao` com "Encerrada pelo limite de 10 h". O
cálculo é determinístico, então todos os aparelhos chegam ao mesmo resultado, e
a tela mostra o número certo mesmo antes da gravação. A gravação usa o envio de
mudanças de sempre (`apply_erp_snapshot_changes`), uma vez por OS.

## Conferência

Lista os equipamentos com `LIMITE_ATINGIDO` ou `INCONSISTENTE` no dia. Ações:

- **Confirmar 10 h**: marca o dia como conferido.
- **Informar liberação real**: grava o evento de liberação com a hora informada
  e recalcula.
- **Continua parado amanhã**: confirma o dia e, no dia seguinte, o período
  começa às 07:00 com uma OS nova.

A conferência fica no registro do dia (`aprovacao`, que já existe em
`ControleEquipamentoDiario`), com quem decidiu e quando.

## Tela de Manutenção

Segue o padrão do Painel de Controle e `docs/superpowers/CHECKLIST_REDESIGN_ABAS.md`.

- Topo, 4 contadores: Parados agora, Horas paradas hoje, Para conferir (em
  destaque quando > 0), Liberados hoje.
- Um cartão por equipamento parado ou que parou hoje: prefixo, situação com
  cor, horas do dia com barra até 10 h, linha do tempo do dia (hora, evento,
  OS, quem lançou) e dois botões: "Liberar agora" (hora atual já preenchida) e
  "Entrou em manutenção".
- Aba Conferência com as três ações acima.
- Abas que continuam: Ordens de serviço (com a marca "Encerrada pelo limite de
  10 h") e Histórico.
- Celular (390 px): uma coluna, botões com no mínimo 44 px, linha do tempo
  vertical. Prints no celular e no computador antes de dar por pronta.

## Relatório do dia

Para a data escolhida (hoje: até o momento).

- Uma linha por equipamento: prefixo, tipo, OS, cada período (entrada →
  liberação ou "em aberto"), descontos, horas do dia e situação.
- Totais: horas paradas, equipamentos e quantos em conferência.
- Total por tipo de equipamento.
- Exportação para Excel com um período por linha.
- Conferência do relatório em três grupos: fechados certinho, limite de 10 h,
  inconsistentes. Mostra "X de Y conferidos". O dia só fica fechado com os dois
  últimos grupos zerados.

## Dados atuais

Ao entrar no ar, as 36 OS abertas passam pela regra nova. As que já passaram de
10 h em algum dia fecham pelo limite e vão para a conferência. Nada é apagado.
Antes de gravar, a lista do que vai mudar é mostrada ao Deivid.

## Testes

`tests/horasParadasDoDia.test.ts` com os exemplos acima, os descontos parciais
(entrada 12:30 desconta só 30 min de almoço) e os casos inconsistentes.
Registrado em `tests/run.ts`.

## Fora do escopo

- Lentidão do banco ao salvar com muitas pessoas (PR separado).
- Os 17 erros de tipo de Pessoas & Presença que já estão na `main`.

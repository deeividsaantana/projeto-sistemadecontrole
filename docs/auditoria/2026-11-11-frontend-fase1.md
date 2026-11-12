# Auditoria do front-end, Fase 1 (inventário e baseline)

Data: 11/11/2026. Base: `main` em `45a7468`. Medido no harness `preview/` com menu lateral (`?screen=<aba>&shell=1`), em 1440, 1024, 768 e 390 px. Nada foi alterado no código nesta fase.

## Baseline

| Comando | Resultado |
| --- | --- |
| `npm run lint` (tsc) | passou, 0 erros |
| `npm test` | passou |
| `npm run build` | passou; aviso de chunk acima de 500 kB só no Excel (940 kB), que carrega sob demanda |
| `npm run check:bundle` | passou; carregamento inicial 302 kB (limite 600 kB) |
| `npm run e2e` | 114 passaram, 4 puladas, 0 falhas |

Sem regressão antiga a separar: nenhum teste falhava antes.

## Varredura automática (12 telas x 4 larguras = 48 medições)

- Rolagem horizontal: 0 em todas.
- Erros de página ou de console: 0.
- Botões, links e campos sem nome acessível: 0.
- Título (`h1`) único e correto em todas as telas.
- Texto abaixo de 12 px: 1 ocorrência em Frotas (até 768 px) e 1 em Usuários.
- Alvos de toque abaixo de 40 px em 390 px: Estacas (colunas do gráfico, 17 px de largura), Presença (barras do gráfico semanal, 36 px) e 1 botão em Combustível ("Lubrificação", 18 px de largura).

## Telas de `PRIMARY_MODULE_IDS`

| Tela | Pergunta que responde | Padrão (`TabelaPadrao`) | Pontos de atenção |
| --- | --- | --- | --- |
| Painel de Controle | Como está a obra hoje? | não usa (só indicadores) | referência visual do padrão |
| Meu dia | O que eu preciso fazer hoje? | não usa | `textarea` e `select` locais |
| Diário de Obra | O que aconteceu na obra no dia? | não usa | pluviômetro é só um campo do dia, sem tela própria |
| Controle de Estacas | Quanto já cravamos? | não usa | 64 alvos pequenos no celular (gráfico de colunas) |
| Solicitações e Compras | Em que etapa está cada pedido? | sim | fluxo completo, ver Fase 5 |
| Controle de Frotas | Qual equipamento está em que situação? | sim | 936 linhas, 9 `catch`, texto de 11 px |
| Manutenção | Quais ordens estão abertas? | sim | 5 `select` e 3 `textarea` locais |
| Combustível | O que foi abastecido? | sim | 84 campos na mesma tela; 1058 linhas |
| Colaboradores | Quem trabalha na obra? | sim | ok nas medições |
| Presença e Controle | Quem veio hoje? | sim | 1969 linhas, 44 `<button>` e 13 `select` locais |
| Cadastros | Quais cadastros existem? | não usa | 56 campos; categorias ainda sem busca própria |

Nenhuma tela usa `LoadingState` ou `ErrorState` dos componentes compartilhados. Só `EmptyState` aparece (Diário, Manutenção, Colaboradores). Nenhuma tela usa `aria-invalid`; só Cadastros e a tabela têm `aria-live`.

## Achados por severidade

**Alta**

1. **A interface não mostra o estado real do salvamento.** O indicador do topo (`DesktopTopBar.tsx`) só diz "Sincronizado" ou "Sem conexão com a nuvem". O envio pendente vive em `uploadPendenteRef` (um `ref`, sem re-render), e o contador "Pendente: N" conta só envios do link público de presença. Não existem os estados salvo no aparelho, aguardando, sincronizando, falhou e tentar novamente. Evidência: `src/App.tsx` linhas 529 e 1152; `src/app/shell/DesktopTopBar.tsx` linhas 177 a 200.
2. **Nenhuma tela usa `aria-invalid` e as mensagens de erro de formulário não são ligadas ao campo.** Evidência: contagem por arquivo em `src/components/*Tab.tsx`.
3. **Falta estado de carregando e de erro padronizado nas telas.** `LoadingState` e `ErrorState` existem em `src/shared/ui/` e nenhuma tela os usa.

**Média**

4. `src/App.tsx` com 4613 linhas concentra estado, sincronização e ações de várias telas. Extrair por domínio, uma fatia por PR.
5. Telas grandes (Presença 1969, Combustível 1058, Frotas 936, Cadastros 933, Manutenção 793 linhas).
6. `<select>` e `<textarea>` locais em Manutenção, Presença, Diário e Meu dia, sem campo compartilhado.
7. Alvos de toque pequenos em Estacas, Presença (gráfico) e 1 botão de Combustível.
8. Os testes E2E de fumaça listam telas que não existem mais no menu (checklist, horas-paradas, orçamento etc.) e não cobrem Meu dia, Solicitações nem Combustível por título. Ver `tests/e2e/telas.spec.ts`.

**Baixa**

9. Dois textos de 11 px (Frotas, Usuários).
10. `src/index.css` com camadas históricas; medir antes de remover.

## Pluviômetro: o que já existe

Há um campo de leitura em mm no Diário de Obra (`src/types.ts`, linha 613) e um `MapaChuva`. Não há cadastro por local, correção auditada, consulta semanal/mensal/acumulada própria nem relatório. Antes de codificar, escrever a especificação (Fase 7).

## Ordem proposta dos próximos PRs

1. Estado de salvamento visível (salvo no aparelho, aguardando, sincronizando, falhou, tentar novamente), ligado ao indicador do topo, com teste.
2. Campos compartilhados com `aria-invalid` e descrição ligada ao campo, aplicados primeiro em Solicitações, Manutenção e Cadastros.
3. Estados de carregando e erro padronizados nas tabelas.
4. Alvos de toque de 44 px no celular (Estacas, Presença, Combustível).
5. Especificação do Pluviômetro (sem código).
6. Atualizar a fumaça E2E para as telas reais.

## Fora de escopo e dependências

- Já existem em outras conversas: proposta de nova sidebar, papel "Acesso total (dev)" em `claude/project-thread-1xtt0l` e o PR #212 (fila de envio única). Os itens 1 e 2 acima precisam esperar o #212 entrar, para não conflitar em `App.tsx`.
- Nenhuma mudança de banco ou de dados de produção está prevista nesta rodada.

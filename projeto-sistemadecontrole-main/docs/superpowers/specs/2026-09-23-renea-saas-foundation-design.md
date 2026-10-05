# RENEA SaaS — especificação da fundação

## Intenção aprovada

Transformar gradualmente o ERP existente em SaaS multiempresa e multiobra. Revisar cada tela e fluxo de verdade, preservar regras e dados, substituir arquitetura e UX ruins, manter Firebase operacional até a reconciliação por domínio e adotar PostgreSQL/Supabase como destino canônico. RDO integra oficialmente o produto; a exclusão registrada em arquitetura anterior está superada.

## Decisões

1. **Migração por fatias verticais.** A fundação é usada primeiro por Cadastros e Materiais/Estoque; nenhum módulo novo copia a arquitetura do `App.tsx` monolítico. Componentes antigos ficam acessíveis até a equivalência funcional ser comprovada.
2. **Contexto explícito.** Toda tela autenticada recebe organização, obra opcional/obrigatória conforme operação, identidade e permissões de uma fonte validada. URL e seleção visual não autorizam acesso. Não inventar organização/obra a partir da constante visual `OBRA`.
3. **Rota canônica progressiva.** `/app/:organizationId/:projectId/:module/*`, com adaptador temporário dos IDs atuais e deep links estáveis. Links públicos preservam os caminhos e o bundle separado.
4. **Design System único.** Tokens semânticos centralizados; `src/shared/ui` é a base, não criar uma segunda biblioteca. `PageHeader`, controles, FilterBar, DataTable e estados compartilham contratos de acessibilidade e densidade. Priorizar composição de primitivas existentes. Uma tabela não deve carregar todos os dados de uma organização para paginar no navegador quando o backend puder paginar.
5. **Módulos de domínio.** Cada módulo define páginas, apresentação, comandos, consultas, tipos e testes. Regras de negócio puras ficam em domínio compartilhado; acesso a banco passa por `src/cloud` e implementações de provedor. Componentes não importam SDK de banco.
6. **Persistência.** Firebase é autoritativo na transição. Uma tabela Supabase nova tem `organization_id`, vínculo de obra quando aplicável, autoria, versão, RLS, índices medidos, migration, teste de isolamento/reconciliação e rollback. `dual-write` é espelho; virar a leitura/escrita exige contagens, IDs e hashes reconciliados e aprovação operacional.
7. **Segurança.** RBAC visual melhora UX; o servidor e RLS decidem acesso. APIs padronizam identidade, escopo, validação, idempotência para comandos sensíveis, erro com request ID e auditoria. Nenhuma credencial administrativa vai para `VITE_*`.
8. **RDO.** Projetar entidade e ciclo de vida próprios. Agregar referências reais de presença, equipamento, combustível, materiais, viagens, produção e clima quando houver fonte. Campo ausente permanece ausente, com indicação de origem e atualização.
9. **Performance.** Rotas e bibliotecas pesadas sob demanda, consultas com escopo e paginação, virtualização quando a lista exigir, medição de bundle e de interação. Remoção de históricos embutidos ou CSS só após mapa de consumidores.

## Contratos da primeira entrega

- Inventário rastreável das 45 telas e fluxos públicos em `docs/SAAS_AUDITORIA_2026-09-23.md`.
- Tokens e padrões semânticos aplicados aos componentes compartilhados; uma referência de Cadastros usa FilterBar e DataTable sem alterar sua regra de gravação.
- Modelo de rota e contexto que rejeita IDs inválidos ou ausência de escopo, com testes de interpretação e isolamento. O contexto real só será ativado quando a fonte de memberships estiver conectada; o sistema não deve fingir multiempresa.
- Plano de decomposição de `App.tsx`: primeiro comandos/consultas de Cadastros e Materiais, depois estado e roteamento, com testes de equivalência. Não deslocar estado em massa sem consumidores mapeados.
- Materiais: separar cadastro, saldos, movimentos e importação no desenho; preservar saldo derivado e linhagem de importação. A conversão completa desse módulo é uma entrega operacional seguinte.

## Critérios de aceite por entrega

Cada entrega documenta escopo, arquitetura, arquivos, migration, testes, aceite, desktop, mobile, impacto, riscos e rollback. Deve manter login, dados locais/remotos, links públicos, permissões e fluxos necessários. Executar `npm run verify`; testes E2E e inspeção visual local nos fluxos alterados. Se um gate preexistente impedir o comando, registrar erro exato e executar gates focados sem declarar verificação integral.

## Sequência

1. Auditoria e especificação: inventário de telas, dados, API, rotas, sobreposições e risco.
2. Fundação: contexto e rota seguros, shell, tokens e componentes compartilhados; referência Cadastros.
3. Materiais/Estoque: cadastro, saldo, movimentos, importação, autorização e reconciliação.
4. Demais domínios, um por vez; RDO com agregação real. Retirada de legado somente após equivalência.

## Pontos de controle

- Nenhum deploy, push, migration em produção ou alteração de dados reais faz parte da autorização desta especificação.
- Após cada domínio, comparar os registros por ID e operação, verificar permissões entre organizações e oferecer rollback do módulo. A migração de provedor é decisão operacional separada.

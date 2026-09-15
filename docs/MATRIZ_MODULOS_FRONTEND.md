# Matriz de Evolucao do Frontend

| Prioridade | Modulos | Estado atual | Proxima entrega |
| --- | --- | --- | --- |
| P0 | Painel, Colaboradores, Equipes, Presenca | Fonte de efetivo diverge no dashboard | Fonte oficial unica, KPIs de efetivo e regressao automatizada |
| P0 | Shell, busca, notificacoes | Sidebar funcional; descoberta limitada | Command palette, busca agrupada e contexto de obra |
| P1 | Combustivel, Frota, Manutencao | Fluxos completos com linguagem visual desigual | Centro de lancamento, timeline e resumo responsivo |
| P1 | Materiais | Cadastro e estoque funcionais | Cobertura, risco, recebimento e consumo por frente |
| P1 | Diario, Planejamento, Producao, Qualidade | Modulos isolados | Lista, detalhe em drawer, filtros salvos e acoes rapidas |
| P2 | Relatorios, Custos, Orcamento | Exportacao existe; descoberta e leitura fracas | Biblioteca por objetivo, resumo executivo e historico |
| P2 | Pessoas complementares | Apontamentos, DDS e treinamentos separados | Perfil unificado e trilha de conformidade |
| P2 | Rotas avancadas | Existem, mas nao aparecem na rotina | Acesso por busca e "Todos os modulos" sem inflar sidebar |

## Criterio de aceite de cada fase

1. Dados usados pela tela sao a fonte canonica do dominio.
2. Estados loading, vazio, erro e sucesso foram exercitados.
3. Desktop, tablet e Pixel 5 nao possuem overflow horizontal.
4. Teclado, foco, contraste e reduced motion foram validados.
5. TypeScript, testes de dominio e Playwright relevante passaram antes do deploy.

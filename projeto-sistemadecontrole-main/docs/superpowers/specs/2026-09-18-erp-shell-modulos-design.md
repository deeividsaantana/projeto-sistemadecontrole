# RENEA ERP — shell compacto e consolidação dos módulos

## Objetivo

Transformar a interface atual em um ERP operacional minimalista, full white e
orientado a dados. A navegação principal terá somente os 13 módulos usados na
sidebar. As telas auxiliares continuarão existindo como fluxos internos dos
módulos principais, sem perda de dados, cálculos, permissões, histórico ou
links públicos.

## Princípios

- O dado operacional ocupa a primeira dobra; títulos decorativos não ocupam
  espaço útil.
- Cada indicador aparece uma única vez no Painel de Controle.
- Branco é a superfície principal. Verde indica operação normal; laranja
  indica atenção/manutenção; vermelho fica reservado para estado crítico;
  cinza indica ausência ou pendência de informação.
- Ausência de dado nunca vira zero inventado.
- Animações usam apenas `transform` e nunca escondem informação com
  `opacity: 0` dependente de gatilho de rolagem.
- Ações e permissões existentes permanecem disponíveis.

## Módulos principais

1. Painel de Controle
2. Modo Campo
3. Central Operacional
4. Planejamento
5. Diário de Obra
6. Controle Operacional de Frotas
7. Manutenção
8. Combustível
9. Colaboradores
10. Presença e Controle
11. Materiais e Estoque
12. Relatórios
13. Administração

Esses módulos são a única navegação primária. Busca global, notificações e
atalhos podem abrir fluxos auxiliares sem transformá-los novamente em itens da
sidebar.

## Consolidação das telas auxiliares

| Fluxo auxiliar | Módulo principal de destino |
| --- | --- |
| Consulta Geral, Pendências, Indicadores e Timeline | Painel de Controle |
| Frentes, Produção, Cronograma, FVS, Inspeções, Não Conformidades, Medições, Documentos, Ocorrências, Tickets e Estacas | Central Operacional |
| Frota, Horas Paradas e Checklist | Controle Operacional de Frotas |
| Equipes, Apontamentos e DDS/Treinamentos | Colaboradores / Presença e Controle |
| Custos e Orçado x Realizado | Relatórios |
| Cadastros, Auditoria e Permissões | Administração |
| Registros por Período | Relatórios, preservando restauração e consulta histórica |
| Assistente e Notificações | Utilitários globais na barra superior |

Consolidar significa incorporar o acesso como subvisão, painel interno,
drawer ou atalho contextual. Não significa apagar componentes, coleções ou
rotas públicas durante esta fase.

## Shell e sidebar

- Largura expandida alvo: `12.5rem`; recolhida: aproximadamente `4.5rem`.
- Cabeçalho da marca mais baixo, itens entre 36 e 40 px e grupos com menos
  espaço vertical.
- Estado ativo branco com contraste simples, sem sombra pesada.
- Sidebar permanece recolhível e mantém preferências no armazenamento local.
- Em telas menores, o drawer usa a mesma lista de 13 módulos.
- O viewport principal deixa de impor `max-width: 1440px` e usa toda a área
  disponível, com espaçamento responsivo pequeno e uniforme.

## Cabeçalhos internos

- O bloco visual `.renea-page-header` deixa de renderizar título, descrição,
  fotografia ou faixa heroica.
- Cada tela mantém exatamente um `h1` semanticamente acessível por meio de uma
  classe visualmente oculta.
- Ações existentes do cabeçalho migram para uma toolbar compacta junto aos
  filtros ou ao primeiro painel de dados.
- Nenhuma ação pode desaparecer durante a migração.

## Painel de Controle

- Remover integralmente o bloco “Fechamento operacional”.
- Remover o “Pulso do dia” duplicado e escolher uma única fonte visual para
  frota, presença, produção e combustível.
- Manter uma faixa compacta de ações e data, seguida pelos dados consolidados.
- Priorizar: cobertura da frota, manutenção versus OS, situação a confirmar,
  presença, combustível, produção e alertas.
- Tickets, medições, estacas e qualidade permanecem acessíveis pela Central
  Operacional, evitando duplicação no painel executivo.

## Manutenção

- Manter a criação automática de OS quando um basculante for salvo como
  “Em manutenção”.
- Reutilizar OS aberta do mesmo equipamento; nunca duplicar silenciosamente.
- Mostrar ícones operacionais por categoria: basculante, escavadeira, máquina
  pesada, caminhão de apoio e equipamento genérico.
- Exibir fluxo, prioridade, oficina, tempo parado, motivo e próxima ação sem
  repetir os mesmos totais em múltiplos cartões.
- Preservar busca, filtros, formulário, avanço de status, conclusão, exclusão
  autorizada e histórico.

## Combustível

- Nesta fase, zerar apenas os lançamentos locais e as sementes de
  abastecimento usadas pelo checkout/localhost.
- Preservar tipos de combustível, comboios, equipamentos, regras de
  importação, auditoria e estrutura do módulo.
- Não apagar dados remotos, sincronizados ou de produção sem uma confirmação
  explícita e uma reconciliação prévia.
- O estado vazio deve explicar como importar ou registrar o primeiro
  abastecimento.

## Movimento e responsividade

- Entrada curta entre 180 e 360 ms usando `translateY` pequeno.
- Dados permanecem visíveis antes, durante e depois da animação.
- Respeitar `prefers-reduced-motion`.
- Desktop e celular não podem produzir rolagem horizontal no documento.

## Entrega incremental

1. Estabilizar o shell, a sidebar, o viewport e o cabeçalho compartilhado.
2. Consolidar o Painel de Controle e retirar duplicações.
3. Finalizar Manutenção e a criação automática de OS.
4. Zerar os dados locais de combustível e redesenhar seu estado vazio.
5. Migrar os demais módulos principais para o shell compartilhado.
6. Incorporar as telas auxiliares em seus módulos de destino.
7. Remover somente rotas internas comprovadamente sem consumidor.

Cada etapa deve passar por testes de unidade, montagem desktop/celular,
interações críticas e inspeção visual autenticada no localhost.

## Critérios de aceite

- A sidebar mostra somente os 13 módulos principais e é visivelmente menor.
- Nenhuma tela principal exibe cabeçalho interno grande.
- Todas as ações antes presentes nos cabeçalhos continuam acessíveis.
- O Painel não repete os mesmos indicadores.
- Manutenção abre, filtra, cria e avança OS; basculante em manutenção gera ou
  reutiliza OS automaticamente.
- Combustível inicia sem lançamentos locais, sem perder cadastros ou regras.
- Todas as telas principais montam sem erro e sem estouro horizontal em
  desktop e celular.
- Nenhuma animação deixa conteúdo invisível quando o gatilho falha.

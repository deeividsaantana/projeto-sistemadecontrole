# Arquitetura do Sistema Integrado de Controle de Obras

## Decisões de base

- O projeto existente permanece uma aplicação React, TypeScript e Vite.
- Firebase Authentication e Firestore continuam sendo o banco e a autenticação reais enquanto a migração é feita. Não há troca de banco sem exportação, validação de integridade e aprovação operacional.
- O módulo de RDO não faz parte desta arquitetura, do menu, do modelo de dados nem da sincronização.
- Cadastros são a fonte única de verdade. Lançamentos operacionais guardam o identificador do cadastro e um resumo histórico somente quando necessário.
- Exclusões são lógicas para cadastros e operações que já possuem vínculos.

## Fronteiras do sistema

| Camada | Responsabilidade |
| --- | --- |
| Interface | Telas responsivas, filtros, validação imediata e feedback de operação. |
| Domínio | Cálculos, regras de duplicidade, transições de status e permissões. |
| Persistência | Firestore com documentos segmentados, regras de acesso e auditoria. |
| Serviços protegidos | Funções de servidor para sequências de ticket, links públicos, importações e operações administrativas. |
| Arquivos | Firebase Storage com caminho por obra, módulo e registro; tipo e tamanho validados. |
| Relatórios | Consultas filtradas e exportação Excel, CSV e PDF sem alterar o dado de origem. |

## Modelo lógico de dados

Cada registro possui id, obraId, createdAt, updatedAt, createdBy, updatedBy, status e, quando aplicável, ativo. As coleções devem ser segmentadas por obra para reduzir leitura e impedir mistura de frentes.

| Grupo | Coleções principais | Regras de integridade |
| --- | --- | --- |
| Organização | obras, ramos, trechos, frentes, empresas, fornecedores | Nome e chave únicos no escopo da obra; inativação preserva histórico. |
| Pessoas e frota | usuarios, funcionarios, motoristas, equipamentos, veiculos | Prefixo e placa normalizados; vínculo obrigatório com empresa. |
| Estacas | estacas, estacaMovimentacoes | Chave única obra+ramo+trecho+numero; comprimento cravado não excede o total. |
| Materiais | materiais, movimentacoesMateriais | Saldo é calculado pelas movimentações; saída negativa exige permissão e justificativa. |
| Viagens | tickets, ticketSequencias | Uma liberação e um recebimento por número; pareamento é transacional. |
| Combustível | abastecimentos, tiposCombustivel | Chave operacional evita duplicidade; bomba final é recalculada no servidor. |
| Operação | utilizacoesEquipamento, presencas, pendencias | Não duplicar pessoa por data; horímetro final não pode reduzir. |
| Governança | auditorias, importacoes, backups | Valores anterior/posterior e justificativa em alterações relevantes. |

## Índices e consultas

- Estacas: obraId, ramoId, trechoId, numeroNormalizado.
- Tickets: obraId, ticketNumeroNormalizado, tipo; e obraId, data.
- Abastecimentos: obraId, data, equipamentoId.
- Movimentações de materiais: obraId, materialId, data.
- Presenças: obraId, data, funcionarioId.
- Pendências: obraId, status, prioridade, prazo.

Os índices compostos devem ser criados somente quando o Firestore os solicitar após uma consulta real. Isso mantém o plano gratuito previsível.

## Perfis e autorização

| Ação | Administrador | Gestor | Operador | Visualização |
| --- | --- | --- | --- | --- |
| Consultar e exportar | Sim | Sim | Módulos autorizados | Sim |
| Criar/editar operação | Sim | Sim | Próprios/autorizados | Não |
| Inativar/restaurar | Sim | Conforme módulo | Não | Não |
| Importar | Sim | Sim | Não | Não |
| Usuários, regras e backup | Sim | Não | Não | Não |

O front-end apenas melhora a experiência; a decisão de acesso deve continuar nas regras do Firestore e nas funções de servidor. Chaves administrativas nunca podem usar o prefixo VITE_ nem ser enviadas ao navegador.

## Fluxos críticos

1. Ticket: cria liberação, reserva número de forma transacional, associa recebimento ao mesmo número e gera pendência até a conclusão.
2. Material: cada entrada, saída ou ajuste cria uma movimentação imutável; o saldo e o alerta de mínimo são derivados dessas movimentações.
3. Estaca: valida chave única, calcula saldo e percentual, registra alteração e permite inativação sem apagar execução anterior.
4. Abastecimento: resolve prefixo e placa pelo cadastro, normaliza horário, recalcula bomba final e impede repetição da mesma operação.
5. Importação: prévia, mapeamento, validação por linha, relatório de erros, confirmação explícita e auditoria. Linhas inválidas ou duplicadas ficam para revisão, sem sobrescrever dados.

## Publicação e custo

A Netlify é a plataforma de publicação definida para este projeto. Firebase permanece responsável por autenticação, Firestore e Storage; a Netlify hospeda o front-end Vite e as funções protegidas usadas por links públicos, reserva de sequência de tickets, importações e operações administrativas.

As funções devem ser usadas apenas para operações que realmente exigem servidor, com validação de autenticação, autorização e limites de tamanho. Consultas comuns continuam diretas no Firestore, sujeitas às regras de segurança, para reduzir consumo de funções e créditos.

## Ordem de implementação

1. Concluir o inventário e remover referências de produto ao RDO.
2. Separar o estado monolítico em coleções de domínio, começando por cadastros, tickets, abastecimentos e materiais.
3. Migrar operações críticas para funções transacionais e auditoria estruturada.
4. Evoluir a página central de pendências e filtros globais com responsável, prazo e acompanhamento.
5. Revisar responsividade, paginação, importação e relatórios.
6. Executar validação em base copiada, exportar backup e somente então publicar.

Nenhuma etapa autoriza apagar registros existentes, substituir dados importados automaticamente ou alterar a infraestrutura de produção sem validação.

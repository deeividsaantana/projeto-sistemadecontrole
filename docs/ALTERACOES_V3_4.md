# Alterações v3.4

## Escopo

Esta versão adiciona somente o módulo de RDO integrado, preservando os módulos, os dados operacionais e as regras existentes.

## RDO integrado

- Nova tela dedicada de consulta, geração, edição e fechamento do Relatório Diário de Obra.
- Pré-preenchimento por data e obra com dados já registrados em presença direta, presença por link, apontamentos, partes diárias de equipamento, viagens da jazida, materiais e ordens de serviço.
- Efetivo consolidado sem duplicar funcionários presentes em mais de uma fonte.
- Divergências entre listas, apontamentos, tickets, materiais e partes diárias permanecem visíveis para conferência, sem ocultar ou descartar registros.
- Clima e condição operacional são sugeridos pelos apontamentos dos turnos manhã, tarde e noite.
- Equipamentos, operadores, horas trabalhadas, viagens, materiais, produção e custos identificados passam a compor o documento diário.
- Produção manual complementar pode ser registrada sem perder a identificação da origem automática.
- Ocorrências, observações, pendências, próximas etapas e até quatro fotos compactadas ficam vinculadas ao RDO.

## Aprovação e fechamento

- Fluxo documental com os estados `Rascunho`, `Em revisão`, `Aprovado` e `Fechado`.
- Aprovação exige responsável pelo RDO e descrição dos serviços executados.
- Fechamento exige aprovação vigente e registra usuário e horário.
- RDO aprovado ou fechado não pode ser excluído.
- Alterações operacionais posteriores à aprovação ou ao fechamento criam uma nova versão, preservam um resumo da versão anterior e exigem nova aprovação.
- RDOs continuam incluídos nos backups, na sincronização Firebase, nas importações e nos snapshots de período já existentes.

## Relatórios

- PDF profissional por RDO com identificação, clima, produção, equipamentos, ocorrências, custos, divergências, auditoria e fotos.
- Excel profissional por RDO com abas de detalhes, produção, equipamentos, viagens, materiais, divergências e revisões.
- Excel consolidado dos RDOs filtrados por texto, status e período.

## Compatibilidade

Todos os novos campos são opcionais no modelo persistido. RDOs criados em versões anteriores são normalizados como rascunho, versão 1, sem perda dos campos originais.

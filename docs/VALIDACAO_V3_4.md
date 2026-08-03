# Validação v3.4

## Consolidação operacional

- Abrir `RDO Integrado` e selecionar `Gerar RDO do dia`.
- Confirmar o preenchimento automático de data, obra, responsável, efetivo, equipamentos, serviços, clima, viagens, materiais e custos disponíveis.
- Confirmar que o mesmo funcionário presente na lista direta e no link é contabilizado uma única vez.
- Comparar efetivo de presença e apontamento e confirmar que qualquer diferença aparece como divergência.
- Usar `Atualizar fontes` e confirmar que os registros automáticos são renovados sem apagar textos ou produção manual.

## Documento e auditoria

- Salvar como rascunho e enviar para revisão.
- Tentar aprovar sem responsável ou serviço e confirmar o bloqueio orientativo.
- Aprovar um RDO completo e conferir usuário, horário e versão.
- Fechar o RDO aprovado e confirmar usuário e horário do fechamento.
- Editar um campo operacional depois da aprovação ou fechamento e confirmar a criação de nova versão em revisão.
- Confirmar que RDO aprovado ou fechado não apresenta exclusão na lista e permanece protegido no manipulador central.

## Relatórios e fotos

- Adicionar até quatro fotos e confirmar a compactação e a visualização.
- Exportar o PDF e conferir dados operacionais, produção, equipamentos, custos, divergências, auditoria e páginas fotográficas.
- Exportar o Excel do RDO e conferir todas as abas.
- Aplicar filtros de período e status e exportar o controle consolidado.

## Compatibilidade e segurança dos dados

- Abrir um RDO legado sem os novos campos e confirmar que ele aparece como `Rascunho`, versão 1.
- Exportar e restaurar um backup JSON e confirmar a preservação dos novos campos.
- Arquivar um período com RDO fechado e confirmar que o documento entra no snapshot já existente.

## Verificações automatizadas

- `tsc --noEmit`
- `tests/run.ts`
- `vite build`

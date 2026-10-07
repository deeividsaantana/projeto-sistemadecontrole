# Validação v3.2

## Cadastros

- Importar `PLANILHA MESTRE DE CADASTROS DE CONTROLE.xlsx`.
- Conferir os resumos por aba e aplicar a planilha.
- Confirmar que empresas, locais, colaboradores, materiais, ramos, equipamentos e veículos aparecem nos cadastros operacionais.
- Reaplicar o mesmo arquivo e confirmar que os registros são atualizados sem duplicação.
- Confirmar que linhas inválidas ou duplicadas continuam disponíveis para revisão.
- Exportar e restaurar um backup para validar a preservação da fila de revisão.

## Manutenção

- Abrir a consulta da frota e selecionar um equipamento.
- Adicionar uma foto e vincular um motorista ou operador.
- Criar uma OS preenchendo motivo, manutenção, horímetros, horas e movimentação.
- Conferir o cálculo automático de disponibilidade.
- Concluir a OS e confirmar a atualização do equipamento para ativo e a data de saída da manutenção.
- Exportar Excel e PDF e conferir indicadores, frota, motoristas e histórico detalhado.
- Editar uma OS antiga para confirmar compatibilidade com registros sem os novos campos.

## Verificações automatizadas

- `tsc --noEmit`
- `tests/run.ts`
- `vite build`


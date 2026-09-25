# Validação ERP v3.3

## Fontes inspecionadas em modo somente leitura

- `BASE_CADASTROS.xlsx`;
- `CONTROLE DE ESTACAS.xlsx`;
- `EFETIVO OBRA.xlsx`;
- `Equipamentos Complexo Alto Tietê.xlsx`;
- `FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx`;
- `VIAGENS JAZIDA SABESP.xlsx`.

O arquivo operacional de Materiais foi deliberadamente excluído da inspeção.

## Verificações executadas

1. `tsc --noEmit`: aprovado sem erros.
2. Suíte `tests/run.ts`: 65 testes aprovados.
3. Testes novos de cadastro central: normalização, ID sequencial, duplicidade, elegibilidade operacional, indicadores e contrato das abas Excel.
4. `vite build`: aprovado, com 3.148 módulos transformados.
5. Exportação: contrato confirma as dez abas previstas e ausência de `CAD_MATERIAIS`.

## Limite de validação

O build de produção foi gerado. A renderização em navegador autenticado e a sincronização com a conta Firebase real dependem do ambiente de publicação e das credenciais do usuário; nenhuma publicação externa foi realizada nesta entrega.

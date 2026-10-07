# ERP v3.3 — Sistema Central de Cadastros

## Resultado

O módulo de cadastros passou a funcionar como fonte única para os módulos operacionais. A implementação mantém as coleções existentes para preservar compatibilidade:

- fornecedores são classificados dentro da entidade única de empresas;
- veículos são uma categoria da entidade única de equipamentos/frota;
- colaboradores, locais e ramos permanecem referenciados pelos mesmos IDs nos módulos operacionais;
- registros importantes são inativados ou desmobilizados, sem exclusão física.

## Colaboradores

O formulário agora cobre os 16 campos da aba `CAD_COLABORADORES`: ID Mestre automático, matrícula, nome, função, divisão, seção, líder, área, responsável, empresa, status, datas de mobilização e desmobilização, situação RH e observação.

O líder é selecionado do cadastro ativo e sua matrícula e nome são gravados automaticamente. Matrícula, nome, função e empresa são obrigatórios. Matrículas duplicadas são bloqueadas.

## Integridade e auditoria

- bloqueio de duplicidade para matrícula, prefixo, placa, CNPJ e nomes mestres;
- IDs sequenciais `COL-`, `EQ-`, `VEI-`, `EMP-` e `FOR-`;
- histórico enriquecido com ID, valor anterior, valor novo e tipo de operação;
- inativação de empresas, fornecedores, colaboradores e locais;
- desmobilização de equipamentos e veículos, preservando lançamentos vinculados;
- colaboradores inativos ou desmobilizados deixam de ser elegíveis nas listas normais.

## Painel e pesquisa

O painel central usa visual corporativo claro, sem azul dominante, e mostra colaboradores ativos/desmobilizados, equipamentos ativos, veículos, fornecedores, inconsistências, última sincronização e quantidade de registros.

A pesquisa global localiza matrícula, nome, líder, responsável, prefixo, placa, empresa, fornecedor, local e ramo.

## Excel e Power Query

O botão `EXPORTAR BASE_CADASTROS` gera um `.xlsx` com as abas:

- `INSTRUÇÕES`;
- `LISTAS_AUX`;
- `PAINEL GERAL`;
- `CAD_EQUIPAMENTOS`;
- `CAD_VEICULOS`;
- `CAD_COLABORADORES`;
- `CAD_EMPRESAS`;
- `CAD_FORNECEDORES`;
- `CAD_LOCAIS`;
- `CAD_RAMOS`.

Os nomes e campos seguem a `BASE_CADASTROS.xlsx`, permitindo que o Power Query continue distribuindo a fonte oficial para as planilhas operacionais.

## Exclusão expressa de escopo

O arquivo `CONTROLE DE MATERIAIS COMPLEXO ALTO TIETE POR RAMO.xlsx` não foi lido, modificado ou integrado. A exportação v3.3 também não gera `CAD_MATERIAIS`.

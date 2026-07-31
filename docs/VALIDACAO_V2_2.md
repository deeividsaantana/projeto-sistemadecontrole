# Validação — ERP v2.2

## Testes adicionados

- `masterWorkbook.test.ts`
- `supabaseMasterDataReview.test.ts`
- ampliação de `masterDataContract.test.ts`;
- ampliação de `masterDataGateway.test.ts`.

## Cenários cobertos

- duas empresas com o mesmo CNPJ entram como duplicadas;
- nomes diferentes da mesma chave são preservados como aliases;
- material sem unidade obrigatória entra como inválido;
- local já existente entra como correspondência;
- equipamento é rejeitado pelo contrato de importação v2.2;
- operador pode preparar lote;
- leitura não pode preparar lote;
- organização enviada à RPC vem do servidor;
- migration contém aliases, fila, RLS e RPC;
- migrations não contêm `DROP TABLE` ou `TRUNCATE`.

## Verificações realizadas

- `package.json` e `package-lock.json` parseados;
- dependências raiz e lockfile reconciliados;
- integridade SHA-512 dos seis pacotes diretos/transitivos confirmada contra os tarballs do registro npm;
- 90 arquivos TypeScript/TSX/JavaScript analisados;
- 77 arquivos TypeScript/TSX sem erro de sintaxe;
- 13 arquivos JavaScript/MJS sem erro de sintaxe;
- importações relativas resolvidas;
- cinco testes de contrato, schema e regras de cadastros executados;
- persistência local preservada, com as mesmas 159 referências e 35 chaves literais da v2.1;
- análise de duplicidade, alias, inválido e correspondência executada;
- gateway simulado com retorno `202` para operador e `403` para leitura.

## Homologação recomendada

1. Aplicar as migrations v2.1 e v2.2 em ordem.
2. Configurar Supabase no Netlify.
3. Abrir Cadastros e selecionar a planilha mestre.
4. Conferir os totais das seis entidades.
5. Revisar duplicados e inválidos.
6. Confirmar as abas postergadas.
7. Preservar os lotes.
8. Conferir `import_batches`, `import_rows`, `master_data_review_items` e `master_data_aliases`.
9. Não promover registros antes da validação pelos responsáveis operacionais.

## Limite local

O ambiente Windows continua bloqueando a criação de processos para `npm`, `tsc` e `vite`. A sintaxe foi analisada pelo compilador TypeScript carregado no processo disponível, mas o build Vite completo deve ser repetido no ambiente de homologação após `npm install`.

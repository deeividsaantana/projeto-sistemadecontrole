# Validação — ERP v2.3

## Testes direcionados

- contrato do gateway;
- estrutura do gateway;
- foundation Supabase v2.1;
- fila mestre v2.2;
- operação de equipamentos v2.3;
- mapeamento da planilha mestre;
- disponibilidade e validações de frota.

## Cenários cobertos

- meta `0,8` convertida para 80%;
- categoria de carreta convertida para implemento;
- equipamento SGE preserva código e meta;
- duas linhas com a mesma placa entram como duplicadas;
- tanque negativo é rejeitado;
- desmobilização anterior à mobilização é rejeitada;
- disponibilidade derivada da parte diária;
- ordem de serviço aberta consolidada;
- parte pendente consolidada;
- operador da última parte usado como referência;
- migration contém tabelas, visão, RLS e RPC;
- migrations não removem tabelas nem truncam dados.

## Reconciliação com as planilhas reais

- 209 linhas de `CAD_EQUIPAMENTOS`: 199 novas, 6 duplicadas e 4 inválidas;
- 82 linhas de `CAD_VEICULOS`: 23 novas, 6 duplicadas e 53 inválidas;
- quatro placas distintas foram detectadas em mais de uma linha;
- 204 linhas de `SGE`: todas mantiveram código de integração e chave de prefixo;
- nenhuma das 65 linhas de `CBs` apresentou divergência entre o código SGE e o prefixo calculado.

## Verificações estáticas

- 94 arquivos TypeScript/TSX/JavaScript analisados;
- 81 arquivos TypeScript/TSX sem erro de sintaxe;
- 13 arquivos JavaScript sem erro de sintaxe;
- importações relativas resolvidas;
- sete testes direcionados executados com sucesso;
- três migrations com transação completa e delimitadores SQL balanceados;
- nenhuma migration contém `DROP TABLE` ou `TRUNCATE`;
- nenhuma ocorrência de `SUPABASE_SERVICE_ROLE_KEY` no cliente;
- nenhuma referência absoluta ao computador local no cliente;
- nenhuma marca de conflito;
- as mesmas 159 referências e 35 chaves literais de `localStorage` da v2.2;
- 155 arquivos reconciliados no pacote, sem remoções em relação à v2.2.

## Homologação recomendada

1. Aplicar as migrations v2.1, v2.2 e v2.3 em ordem.
2. Importar `PLANILHA MESTRE DE CADASTROS DE CONTROLE.xlsx`.
3. Conferir 209 linhas de equipamento e 82 linhas de veículo.
4. Revisar as quatro placas repetidas.
5. Importar `Equipamentos Complexo Alto Tietê.xlsx`.
6. Conferir 204 linhas SGE e a aba `CBs` postergada.
7. Validar empresa, operador e combustível dos registros.
8. Conferir o Centro Operacional contra Manutenção e Parte Diária.
9. Não promover registros antes da aprovação operacional.

## Limite local

O projeto não possui `node_modules` neste ambiente e o runtime disponível não contém Vite ou esbuild. A sintaxe foi analisada com TypeScript 6.0.3 e os testes direcionados foram executados no processo Node disponível, mas o build Vite completo deve ser repetido após `npm install` no ambiente de homologação.

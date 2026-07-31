# Matriz Planilhas → Módulos v3.0

| Arquivo | Regras principais | Módulo |
|---|---|---|
| Planilha mestre de cadastros | identificadores, empresas, obras, pessoas, frota, materiais e ramos | Cadastros mestres |
| Equipamentos Complexo Alto Tietê | prefixo, proprietário, mobilização, disponibilidade e manutenção | Equipamentos |
| Fornecimento de Combustível | leituras, litros, horímetro, responsável, cronologia e conferência | Combustível |
| Viagens Jazida SABESP | liberação, recebimento, número, placa, material, destino e pareamento | Tickets Jazida |
| Controle de Materiais por Ramo | quantidade, densidade, m³, fornecedor, placa, NF, destino e custo | Materiais |
| Controle de Estacas | NF, lote, perfil, peso, valor, cravação, sobra, perda e saldo | Estacas |
| Efetivo Obra | matrícula, função, líder, área, responsável, situação e resumo | Pessoas e Presença |
| Relatório Comercial SPMAR | descarte, placa, autorização, vale, peso, valor e pagamento | Relatórios |

## Problemas eliminados

- repetição de empresa, veículo, material e destino;
- fórmulas copiadas por milhares de linhas;
- abas com dimensão até a última linha do Excel;
- divergências ocultas em campos vazios;
- dependência de `XLOOKUP`, `SUMIFS` e referências quebradas;
- conferência manual entre liberação e recebimento;
- ausência de histórico fechado e verificável.

## Preservação

As fórmulas foram transformadas em funções de domínio. Cadastros não são duplicados por módulo. Registros desconhecidos ou incompletos permanecem disponíveis para revisão.

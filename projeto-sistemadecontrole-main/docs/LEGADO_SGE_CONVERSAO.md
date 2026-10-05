# Conversão do legado SGE

## Fontes analisadas

- `BEApeqOf (1).accdb`
- `SGE CCVS 4.9 (1).accdb`

O segundo arquivo funciona como aplicação/consultas do SGE. Os dados operacionais
úteis estavam principalmente no banco `BEApeqOf`.

## Conteúdo preservado

- 3.660 jornadas entre 08/04/2026 e 30/06/2026.
- 185 equipamentos no cadastro legado.
- 90 pessoas vinculáveis aos apontamentos.
- 17.124,50 horas produtivas (HT).
- 18.446,33 horas de parada (HP).
- 1.243 linhas de produção/transporte.
- Códigos e descrições de interferências/paralisações.

Quatro jornadas foram reconstruídas a partir de linhas HT/HP/produção que não
tinham cabeçalho correspondente em `Apropriação`. Elas permanecem identificadas
como órfãs e inconsistentes, preservando 100% das 9.408 linhas HP, 3.507 linhas
HT e 1.243 linhas de produção.

O arquivo convertido está em `public/legacy-data/sge-operacional.json`. Ele é
carregado somente quando o administrador abre **Parte Diária > Legado SGE**.

## Mapeamento

| SGE antigo | Webapp |
| --- | --- |
| Apropriação | Jornada, horímetro inicial/final e observação |
| HT | Atividades produtivas e frente/UA trabalhada |
| HP | Paradas, código de perda e duração |
| Interferencias | Catálogo de motivos de parada |
| tbl_Oper_Equipamento + EfetivoCompleto | Operador, matrícula e cargo |
| tblProducao | Transporte, origem, destino, material e viagens |
| tblEquipamentos | Cadastro e família do equipamento |

## Regra de migração

A consulta do legado não grava nada no Firebase. A migração é intencional e
limitada a 250 fichas por lote filtrado. Registros migrados mantêm um ID estável
com prefixo `legacy-sge-`, o que impede a mesma ficha de ser importada duas vezes.

Não foi encontrada uma tabela de abastecimentos/combustível nesses dois bancos.
Por isso, nenhum dado de diesel foi inferido a partir de horas ou produção.

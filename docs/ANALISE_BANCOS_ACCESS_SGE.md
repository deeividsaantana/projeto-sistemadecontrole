# Análise funcional dos bancos SGE

Arquivos analisados em modo somente leitura:

- `C:\SGE\BEApeqOf.accdb` — 5.054.464 bytes
- `C:\SGE\SGE CCVS 4.9.accdb` — 29.097.984 bytes

Data da análise: 25/07/2026.

## Visão geral

O sistema Access está dividido em duas partes:

- **BEApeqOf** é a base operacional. Guarda equipamentos, efetivo, apropriações,
  horas trabalhadas (HT), horas paradas (HP), operadores, produção, materiais,
  origens/destinos, programação de horas e cadastros de paralisação.
- **SGE CCVS 4.9** é a aplicação de uso. Ela vincula tabelas da primeira base
  pelo caminho fixo `C:\SGE\BEApeqOf.accdb` e acrescenta formulários, consultas,
  relatórios, importações e automações.

O inventário encontrou:

| Item | BEApeqOf | SGE CCVS 4.9 |
|---|---:|---:|
| Tabelas visíveis | 23 | 30 |
| Campos inventariados | 146 | 170 |
| Consultas salvas | 0 | 61 |
| Formulários | 0 | 66 |
| Relatórios | 0 | 27 |
| Módulos VBA | 0 | 7 |
| Macros | 0 | 5 |

## Volume operacional confirmado

| Conjunto | Registros |
|---|---:|
| Apropriações de jornada e horímetro | 3.656 |
| Horas paradas (HP) | 9.408 |
| Horas trabalhadas (HT) | 3.508 |
| Vínculos operador/equipamento/turno | 3.414 |
| Produções e viagens | 1.244 |
| Equipamentos | 185 |
| Colaboradores | 90 |
| Origens e destinos | 94 |
| Dias/horas programadas | 91 |
| Tipos de material | 18 |
| Motivos de paralisação | 16 |

As tabelas de produção de concreto, perfuração e manutenção existem, mas estão
vazias nesses arquivos. As telas e consultas correspondentes continuam no SGE.

## Funções existentes no Access

### Lançamento operacional

- Apropriação por data, turno, equipamento e horímetro inicial/final.
- Horas trabalhadas distribuídas por UA/frente de serviço.
- Horas paradas distribuídas por código e tipo de paralisação.
- Vínculo do operador à jornada do equipamento.
- Produção de transporte com equipamento, equipamento de carga, origem,
  destino, material, viagens, ticket, peso e horário.
- Produção de perfuração por quantidade de furos e comprimento.
- Produção de central de concreto por volume.
- Registro de manutenção por equipamento, empresa, responsável, falha, parada
  e tempo.

### Importação e conferência

- Áreas temporárias de importação de apropriação, HT e HP.
- Inclusão, atualização e exclusão controlada dos registros importados.
- Consulta de fichas faltantes, fichas faltantes com HT e PDs faltantes.
- Inconsistência de transporte sem HT, carga sem HT e origem/destino inválido.
- Acerto de horímetros e localização de equipamento/operador.

### Indicadores e fechamento

- Horas trabalhadas, horas paradas e horas totais por UA, equipamento e família.
- Disponibilidade mecânica e comparação com a meta do equipamento.
- Utilização da frota.
- MTBF calculado a partir de HT e eventos de parada mecânica.
- Produtividade de transporte, carga, perfuração e central de concreto.
- Quantidade de viagens e principais origens/destinos.
- Fechamento de equipamentos alugados e terceiros.
- Planejamento de equipamentos e viagens.

### Relatórios e saída

- Ficha de apropriação.
- Gráfico de horas paradas.
- Disponibilidade mecânica.
- Produção diária.
- Horas por UA, família e detalhe.
- Relatórios de terceiros, produtividade, faltantes, tickets, veículos leves e
  tipos de paralisação.
- Macros de exportação e menu personalizado.

## Deficiências técnicas encontradas

1. **Dependência de caminho fixo.** A interface depende de
   `C:\SGE\BEApeqOf.accdb`; mover a pasta ou trabalhar em outro computador pode
   quebrar todos os vínculos.
2. **Concorrência frágil.** O Access não oferece a mesma proteção contra duas
   pessoas editarem o mesmo conjunto operacional ao mesmo tempo.
3. **Baixa rastreabilidade.** A maioria das tabelas transacionais não registra
   criador, data de criação, última alteração e motivo da correção.
4. **Chaves e relações incompletas.** HP, HT, produção e vários cadastros não
   possuem uma chave primária clara; há apenas oito relações na base operacional.
5. **Consultas acopladas aos formulários.** Várias regras leem diretamente
   campos como `[Formulários]![frmProdutividades]![Inicio]`, dificultando testes,
   reuso e manutenção.
6. **Duplicações históricas.** Existem consultas e relatórios `OLD`, `Cópia` e
   variações com a mesma finalidade, o que aumenta o risco de usar uma fórmula
   antiga.
7. **Importação com operações destrutivas.** As rotinas possuem consultas de
   atualizar e excluir; uma planilha fora do padrão pode exigir correção manual.
8. **Sem controle de acesso por função.** A proteção depende do arquivo e do
   ambiente local, não de permissões por usuário e operação.
9. **Baixa portabilidade e recuperação.** Banco, interface, consultas e regras
   ficam concentrados em arquivos locais, com pouca observabilidade de falhas.

## Correspondência no sistema web

| Função do Access | Forma intuitiva no sistema web |
|---|---|
| Apropriação, HT, HP e horímetro | Parte Diária, em uma única ficha por equipamento/data |
| Operador e frente de serviço | Seleção direta dos cadastros de funcionário, obra e equipamento |
| Produção/viagens | Linhas de transporte dentro da parte diária |
| Motivos de HP | Código de perda com cálculo automático das horas |
| Fichas e inconsistências | Status Pendente, Inconsistente, Com deficiência e Conferido |
| Importações APROP/HT/HP | Importação de planilha com prévia e revisão antes de confirmar |
| Disponibilidade, utilização e MTBF | Aba **Indicadores SGE**, com filtros e comparação de meta |
| Produtividade de carga/transporte | Ranking por UA com viagens/hora e cargas/hora |
| Gráfico/mapa de HP | Ranking de paradas por código, tipo, horas e ocorrências |
| Origem/destino | Ranking de rotas e materiais |
| Faltantes e inconsistências | Lista única de pendências com o motivo explícito |
| Fechamento de terceiros | Resumo por empresa, equipamentos, HT, HP, viagens e utilização |
| Relatórios exportáveis | CSV dos indicadores e PDF/Excel das fichas operacionais |
| Dados históricos | Aba Legado SGE com migração por filtro, sem duplicar registros |

## Implementação realizada

- Adicionada a aba **Indicadores SGE** dentro de Parte Diária de Equipamentos.
- Incluídos filtros por período, família, empresa, UA, equipamento e operador.
- Incluídos disponibilidade mecânica, utilização, MTBF, HT, HP e HP mecânica.
- Incluídos produtividade de transporte e carga, ranking de paradas e rotas.
- Incluída fila de pendências e inconsistências com justificativa.
- Incluído fechamento consolidado de terceiros.
- Incluída exportação CSV dos indicadores filtrados.
- Mantida a aba Legado SGE para consultar e migrar as jornadas históricas sem
  duplicação.

## Limite atual identificado

A conversão legada contém jornadas, HT, HP, operadores e produção de viagens.
As tabelas atuais de perfuração, concreto e manutenção estão vazias; por isso as
telas e fórmulas foram mapeadas, mas não há registros reais desses três conjuntos
para demonstrar indicadores. Quando começarem a receber lançamentos, devem entrar
no mesmo fluxo de importação, nuvem, filtros, exportação e auditoria.

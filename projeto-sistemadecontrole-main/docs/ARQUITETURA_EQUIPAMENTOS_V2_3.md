# Arquitetura de Equipamentos — ERP v2.3

## Fontes operacionais analisadas

### PLANILHA MESTRE DE CADASTROS DE CONTROLE.xlsx

- `CAD_EQUIPAMENTOS`: 209 linhas, 14 campos;
- `CAD_VEICULOS`: 82 linhas, 8 campos;
- equipamento identificado principalmente por prefixo;
- veículo identificado por prefixo e placa;
- mobilização, meta de disponibilidade, datas, empresa, operador, combustível e capacidade do tanque ficam no cadastro mestre;
- quatro placas aparecem repetidas em `CAD_VEICULOS` e devem permanecer em revisão.

### Equipamentos Complexo Alto Tietê.xlsx

- `SGE`: 204 linhas com frota, código de integração, descrição, família, mobilização, meta, datas, empresa e status;
- `CBs`: 65 controles diários de caminhões;
- o `XLOOKUP` transforma o código SGE em prefixo;
- as 65 linhas conferidas mantêm correspondência entre o código SGE e o prefixo;
- 19 linhas possuem entrega identificada, 42 estão sem informação, 2 registram parte mal preenchida e 2 registram não entrega.

## Problemas preservados para revisão

- status de origem como `A DEFINIR` e `LEVANTAMENTO 20/07/2026` não são convertidos silenciosamente;
- valores de data incompletos permanecem no lote original;
- placas repetidas não são descartadas;
- operador ainda aparece como texto livre em parte da origem;
- equipamento e veículo podem representar o mesmo ativo sob perspectivas diferentes;
- linhas da aba `CBs` não são promovidas como cadastro mestre.

## Fonte única de verdade

O array existente `equipamentos` continua sendo a fonte operacional local para as telas atuais. A v2.3 amplia o mesmo objeto com campos opcionais, portanto registros antigos continuam válidos e não há uma segunda coleção local concorrente.

No modelo Supabase:

- `equipment` e `vehicles` representam os cadastros canônicos;
- `equipment_external_identifiers` preserva o código SGE e outros identificadores;
- `equipment_mobilizations` preserva períodos e locais;
- `equipment_operator_assignments` preserva o responsável por período;
- `equipment_operational_events` recebe eventos de parte diária, manutenção, disponibilidade e status;
- `equipment_operational_overview` consolida os indicadores sem duplicar o cadastro.

## Fluxo implantado

1. O usuário seleciona a planilha mestre ou o controle de equipamentos.
2. `CAD_EQUIPAMENTOS`, `CAD_VEICULOS` e `SGE` são normalizados.
3. Todas as linhas com conteúdo entram na análise.
4. Prefixos repetidos, placas repetidas, campos obrigatórios ausentes e registros já existentes recebem classificação.
5. A aba `CBs` permanece postergada para conciliação com a Parte Diária.
6. O gateway prepara os lotes por organização.
7. Nenhum registro é promovido automaticamente.

## Integrações operacionais

- a seleção do equipamento na Parte Diária sugere o operador responsável cadastrado;
- o Centro Operacional mostra a última parte, pendências e horas trabalhadas;
- ordens de serviço abertas são consolidadas por equipamento;
- disponibilidade cadastrada tem prioridade; sem ela, o painel deriva o percentual pelas partes diárias;
- a meta é comparada com o percentual calculado;
- implementos podem apontar para o equipamento trator vinculado.

## Regras de validação

- prefixo, descrição e empresa continuam obrigatórios;
- capacidade do tanque, quando informada, deve ser maior que zero;
- meta de disponibilidade deve ficar entre 0% e 100%;
- desmobilização não pode ser anterior à mobilização;
- veículo sem placa entra como pendência;
- implemento sem vínculo entra como alerta;
- registros históricos e desconhecidos são preservados para decisão.

## Limite desta versão

A v2.3 cria a fundação normalizada e mantém a operação atual íntegra. A promoção definitiva da fila mestre e a sincronização gradual dos eventos locais com o Supabase devem ser ativadas somente após homologação das migrations, dos vínculos de empresa e dos responsáveis operacionais.

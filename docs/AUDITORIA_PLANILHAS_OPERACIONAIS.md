# Auditoria das Planilhas Operacionais

Data da auditoria: sexta-feira, 31/07/2026

## 1. Objetivo

As 12 planilhas indicadas pelo usuário foram tratadas como documentação viva das regras de negócio. A análise considerou:

- finalidade de cada aba;
- estrutura das tabelas;
- fórmulas;
- validações;
- vínculos externos;
- cadastros repetidos;
- relacionamento entre processos;
- riscos de retrabalho;
- transformação recomendada em módulos do ERP.

A auditoria não copiou dados pessoais para o repositório. O inventário técnico sem linhas operacionais está em docs/auditoria/inventario-planilhas.json.

## 2. Princípios extraídos das planilhas

1. Cadastro deve existir antes do lançamento operacional.
2. Campos sem informação devem permanecer vazios; não criar estimativas para completar histórico.
3. O mesmo identificador deve conectar as duas pontas do fluxo.
4. Dados de equipamento, placa, empresa, fornecedor, material, local e ramo não devem ser redigitados em cada módulo.
5. Fórmulas de conferência devem virar regras de domínio auditáveis.
6. Divergências devem gerar pendência de revisão, nunca exclusão silenciosa.
7. Exportação deve continuar reproduzindo os formatos necessários à operação.
8. Planilhas antigas e backups devem ser fontes de importação, não fontes paralelas permanentes.

## 3. Planilha mestre

Arquivo: PLANILHA MESTRE DE CADASTROS DE CONTROLE.xlsx

Modificado em 31/07/2026. É o artefato mais próximo de uma fonte de verdade integrada e deve orientar o modelo inicial do Supabase.

### Abas de orientação e apoio

#### INSTRUÇÕES

Define explicitamente:

- atualização dos cadastros antes das bases;
- proibição de substituir histórico por estimativas;
- cadastro prévio de material;
- cadastro de prefixo, combustível e capacidade antes do abastecimento;
- relação obrigatória entre liberação e recebimento de viagem;
- ausência atual de chave comum segura entre recebimento e cravação de estacas;
- uso das abas BASE_* para BI.

#### LISTAS_AUX

Concentra listas controladas para status, tipos e classificações. No ERP, essas listas devem virar enums versionados ou tabelas parametrizáveis, conforme o risco de mudança operacional.

#### PAINEL GERAL

Consolida:

- registros de materiais;
- litros de combustível;
- viagens completas;
- colaboradores ativos;
- equipamentos ativos;
- metros cravados;
- totais por mês, status e material.

As fórmulas usam COUNTA, SUM, COUNTIF e SUMIF sobre as bases normalizadas.

### Cadastros mestres

#### CAD_EQUIPAMENTOS

Campos principais:

- ID mestre;
- prefixo;
- placa;
- equipamento;
- família;
- empresa;
- status;
- mobilização;
- meta de disponibilidade;
- datas de mobilização e desmobilização;
- operador ou responsável;
- combustível;
- capacidade do tanque.

Validações:

- status em ATIVO, INATIVO, MANUTENÇÃO, PARADO ou DESMOBILIZADO;
- capacidade do tanque maior que zero.

#### CAD_VEICULOS

Cadastro separado para veículo, prefixo, placa, família, empresa, status e responsável. O ERP deve distinguir equipamento operacional, veículo rodoviário e implemento, mas permitir vínculo entre eles.

#### CAD_COLABORADORES

Campos de matrícula, nome, função, divisão, seção, líder, área, responsável, empresa, status, mobilização, situação de RH e observação.

Validação de status:

- ATIVO;
- INATIVO;
- FÉRIAS;
- AFASTADO;
- DESMOBILIZADO.

#### CAD_MATERIAIS

Contém código original, descrição, tipo, perfil, aço, comprimento, NCM, unidade, peso unitário, observação e fonte.

#### CAD_EMPRESAS

Contém ID, nome, tipos, CNPJ e status. Deve atender empresa própria, prestador, transportadora, fornecedor, proprietário de equipamento e cliente sem duplicar o mesmo CNPJ.

#### CAD_FORNECEDORES

Contém ID, fornecedor, CNPJ e status. Recomenda-se manter fornecedor como papel de uma empresa, não como cópia isolada, quando houver CNPJ comum.

#### CAD_LOCAIS

Contém ID, local, tipo e status. Deve centralizar obra, origem, destino, jazida, bota-fora, canteiro e frente de serviço.

#### CAD_RAMOS

Contém ID, ramo ou trecho, status e fontes. Deve substituir listas textuais espalhadas por materiais, viagens, apontamentos e relatórios.

### Bases operacionais integradas

#### BASE_ESTACAS_RECEB

Uma linha por recebimento ou movimento de material siderúrgico, com NF, material, peso, valor, cavalo, carreta, transportadora, destino, carregamento e status.

#### BASE_ESTACAS_CRAV

Uma linha por item cravado, com identificação, perfil, comprimento total, comprimento cravado, sobra ou perda e aproveitamento.

#### BASE_EFETIVO

Base de colaboradores e organização operacional.

#### BASE_EQUIPAMENTOS

Espelho operacional do cadastro mestre de equipamentos.

#### BASE_VIAGENS

Une liberação e recebimento por ticket, calcula quantidade de vias, status do par, conferência, dados das duas pontas e duração.

#### BASE_MATERIAIS

Normaliza todas as abas de material em uma única estrutura:

- movimentação;
- material;
- unidade;
- quantidade;
- suporte ou viagens;
- volume de caçamba;
- total em m³;
- fornecedor;
- placa;
- prefixo;
- nota fiscal;
- origem;
- destino;
- ramo;
- valores;
- observação;
- aba de origem.

Validações:

- quantidade maior ou igual a zero;
- unidade em TON, KG, M³, M, UN ou VIAGEM.

#### BASE_COMBUSTIVEL

Normaliza data, prefixo, descrição, KM, horímetro, litros, hora, comboio, combustível, empresa, bomba, consumo, custo, capacidade e status de cadastro.

Validações:

- litros maior que zero;
- combustível em lista controlada.

### Transformação recomendada

A planilha mestre não deve ser reproduzida como uma tela gigante. Ela deve virar:

- serviço de cadastros mestres;
- repositórios por entidade;
- importador de bases históricas;
- painel consolidado;
- relacionamentos por IDs;
- trilha de auditoria;
- exportador compatível com as abas BASE_*.

## 4. Estacas

Arquivo: CONTROLE DE ESTACAS.xlsx

Modificado em 30/07/2026.

### Listas

Aba oculta com unidades, tipos de material, status, movimentos, sim ou não e formas de carregamento.

Destino no ERP: parâmetros controlados do módulo Estacas.

### Cadastro Materiais

Aba oculta com materiais siderúrgicos, perfil, aço, comprimento, NCM, unidade e peso.

Destino no ERP: cadastro mestre de materiais com especialização siderúrgica.

### Veículos

Aba oculta com cavalo, semirreboque, proprietário, RENAVAM, chassi e eixos.

Destino no ERP: veículos e implementos vinculados à transportadora ou proprietário.

### Conferência

Relaciona descrição e nota fiscal para conferência.

Destino no ERP: fila de conferência documental e de recebimento.

### Lançamentos

Registra movimento, NF, material, peso, valor, placas, transportadora, destino, carregamento e status.

Regra principal:

- valor total = peso vezes valor unitário.

Destino no ERP: recebimentos e movimentações de estacas.

### Cravações

Registra data, item, serviço, identificação, perfil, comprimento total e comprimento cravado.

Destino no ERP: produção de cravação e consumo de estoque.

### Resumo

Consolida lançamento, peso, valor, cravações e notas fiscais.

Problema encontrado:

- existe fórmula COUNTA apontando para Lançamentos!#REF!, portanto o indicador de total de lançamentos está quebrado no arquivo analisado.

### Relacionamento crítico

A própria planilha mestre informa que não existe chave comum segura entre recebimento e cravação. O ERP não deve inventar essa associação.

Implementação correta:

- criar lote de recebimento;
- criar item físico ou lote de perfil;
- registrar perfil, aço e comprimento;
- permitir associação assistida da cravação ao lote;
- manter cravação não associada como pendência revisável;
- calcular saldo somente quando houver vínculo confirmado.

## 5. Materiais por ramo

Arquivos:

- CONTROLE DE MATERIAIS COMPLEXO ALTO TIETE POR RAMO.xlsx, modificado em 31/07/2026;
- CONTROLE DE MATERIAIS COMPLEXO ALTO TIETE POR RAMO BACKUP.xlsx, modificado em 30/07/2026.

Os dois arquivos não são idênticos. O arquivo sem BACKUP é mais recente e deve ser tratado como referência principal, mantendo o backup apenas para reconciliação.

### RES_GERAL

Painel por período, destino ou ramo e tipo de material.

Regras identificadas:

- SUMIFS por data, destino e material;
- conversões por fatores como 1,5, 1,28 e 1,3;
- consolidação de volume e quantidade por ramo.

Os fatores devem ser parametrizados por material e unidade, com data de vigência e auditoria. Não devem permanecer escondidos em fórmulas de célula.

### RACHÃO

Tabela de data, item, unidade, quantidade, suporte, fornecedor, placa, nota, destino, valor unitário e total.

Regra:

- total = quantidade vezes valor unitário.

### MACADAME

Mesmo fluxo de recebimento, com observação adicional.

### SOLO REFORÇADO

Mesmo fluxo, porém o total usa suporte vezes valor unitário. A tabela e as fórmulas foram estendidas até a linha 1.048.576, causando grande aumento de arquivo e processamento.

### BICA CORRIDA

Fluxo equivalente de quantidade, suporte, fornecedor, placa, nota, local e valores.

### BRITA 02

Fluxo equivalente, com cabeçalho inconsistente denominado Coluna1.

### AREIA INDUSTRIAL

Aba oculta com quantidade e quantidade2, indicando duplicidade de semântica que deve ser resolvida na importação com preservação do valor original.

### BOTA FORA (LARA)

Controle de saída ou descarte com quantidade, suporte, fornecedor, placa, nota, local e custo.

### BOTA FORA (ITAQUAREIA)

Controle de carregamento e total, com estrutura diferente das demais abas.

### Q.E.SÃO BENTO SPE LTDA

Fluxo semelhante ao bota-fora, separado por contraparte.

### LANÇ_MAT-RENEA

Aba oculta com data, prefixo, material, quantidade, volume da caçamba, total m³, carregamento e descarga.

### Validações e problemas

- listas de destino referenciadas dentro das próprias abas;
- várias validações cobrem intervalos até a última linha do Excel;
- uma validação encontrada contém fórmula #REF!;
- há três vínculos externos e nomes definidos apontando para outros arquivos;
- colunas variam entre ITEM, MATERIAL, Coluna1, QUANTIDADE2, LOCAL e LOCAL/DESTINO;
- fornecedor, placa e destino são redigitados;
- uma planilha por material multiplica fórmulas, validações e risco de divergência.

### Transformação recomendada

Criar um único módulo Materiais com:

- material mestre;
- tipo de movimento;
- origem;
- destino;
- ramo;
- fornecedor;
- veículo ou equipamento;
- documento fiscal;
- quantidade e unidade original;
- volume convertido;
- regra de conversão versionada;
- custo;
- status de conferência;
- origem da importação.

As antigas abas viram filtros e relatórios, não tabelas independentes.

## 6. Viagens e tickets de jazida

Arquivos:

- CONTROLE DE VIAGEMS JAZIDA SABESP.xlsx, modificado em 29/07/2026;
- VIAGENS JAZIDA SABESP.xlsx, modificado em 31/07/2026.

O arquivo VIAGENS JAZIDA SABESP.xlsx é mais recente e contém regras adicionais. O arquivo antigo deve permanecer como fonte histórica de importação.

### LIBERAÇÃO

Campos:

- data;
- ticket;
- prefixo;
- placa;
- hora de saída;
- material;
- volume;
- destino;
- conferência automática.

Regras do arquivo mais recente:

- ticket repetido na mesma via gera TICKET DUPLICADO;
- ausência de recebimento gera SEM RECEBIMENTO;
- comparação com a outra via verifica prefixo, placa, material e volume;
- igualdade gera CONFERIDO;
- diferença gera DIVERGÊNCIA.

### RECEBIMENTO

Campos:

- data;
- ticket;
- prefixo;
- placa;
- hora de chegada;
- material;
- volume;
- ramo;
- estaca;
- status.

A área automática recupera prefixo e placa da liberação, calcula status do par, conferência e duração.

### CADASTRO

Aba oculta com listas de apoio para preenchimento.

### CONTROLE TICKETS

Mantém ticket, situação, data de impressão, cancelamento e observação.

Regras:

- CANCELADO quando houver data de cancelamento;
- UTILIZADO quando aparecer em liberação ou recebimento;
- IMPRESSO quando houver impressão sem uso;
- DISPONÍVEL nos demais casos.

### INDICADORES

Consolida pares completos, pendências, divergências, duplicidades, duração, volume e situação dos tickets.

Problemas:

- existem fórmulas de indicadores com #REF!;
- intervalos de conferência usam limites fixos de linhas;
- os dados da liberação e do recebimento são duplicados;
- o status depende de fórmulas espalhadas por abas.

### Transformação recomendada

O sistema já possui TicketsJazidaTab e deve evoluí-lo, não criar um fluxo concorrente.

Modelo recomendado:

- ticket como entidade principal;
- evento de liberação;
- evento de recebimento;
- sequência e lote de impressão;
- devolução de cada via;
- status calculado por serviço de domínio;
- divergências detalhadas por campo;
- vínculo com veículo, equipamento, material, local e ramo por ID;
- preservação do valor textual original quando não houver cadastro.

## 7. Efetivo

Arquivo: EFETIVO OBRA.xlsx

Modificado em 24/07/2026.

### Custo Gerencial

Fonte de colaboradores com empresa, filial, matrícula, nome, divisão, seção, cargo e situação.

### Resumo

Agrupamentos gerenciais do efetivo.

### Efetivo

Relaciona matrícula do colaborador, nome, função, matrícula do líder, nome do líder, área e responsável.

Regras:

- XLOOKUP busca nome e cargo pela matrícula;
- XLOOKUP busca nome do líder pela matrícula de liderança.

### Transformação recomendada

Criar:

- colaborador mestre;
- vínculo empregatício;
- situação de RH;
- lotação por obra e período;
- função;
- divisão e seção;
- liderança hierárquica;
- responsável de área;
- mobilização e desmobilização;
- presença diária como evento separado.

A matrícula é uma chave de negócio, mas o banco deve usar UUID como chave primária.

## 8. Equipamentos

Arquivo: Equipamentos Complexo Alto Tietê.xlsx

Modificado em 30/07/2026.

### SGE

Cadastro de frota com:

- prefixo;
- código de integração;
- descrição;
- família;
- mobilização;
- meta de disponibilidade;
- datas;
- empresa;
- status.

### CBs

Controle diário dos caminhões basculantes, relacionando data, código SGE, prefixo, lista de campo e entrega da parte diária pelo motorista.

Regra:

- XLOOKUP converte o código SGE em prefixo.

### Transformação recomendada

Separar:

- equipamento mestre;
- identificadores externos;
- veículo e placa;
- mobilização;
- operador responsável por período;
- entrega e conferência da parte diária;
- disponibilidade mecânica;
- histórico de status.

O sistema já possui Equipamento e ParteDiariaEquipamento. A evolução deve adicionar os campos faltantes e relacionamentos, preservando IDs existentes.

## 9. Combustível

Arquivos:

- FORNECIMENTO DE COMBUSTIVEL - JUNHO2026.xlsx;
- FORNECIMENTO DE COMBUSTIVEL - JULHO2026.xlsx;
- FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx.

### Junho de 2026

Abas:

- DadosHT;
- DadosHP;
- Dpara;
- Eqtos;
- Serviço_Interferencias;
- ResumoHT_HP;
- ResumoDiesel;
- Planilha1;
- DadosCombustível;
- Insumos.

Fluxo:

- importar dados de horímetro e produção;
- converter códigos por Dpara;
- buscar equipamento e empresa;
- classificar serviço e interferência;
- converter horas Excel;
- consolidar por equipamento e serviço;
- consolidar diesel;
- gerar base detalhada.

A planilha usa XLOOKUP, VLOOKUP, SUMIFS, SUBTOTAL e conversões de horário.

### Julho de 2026

Abas:

- Resumo;
- Detalhe;
- Equipamentos.

O Detalhe registra data, prefixo, descrição, KM, horímetro, litros, hora, comboio, combustível e empresa. A descrição e a empresa são buscadas pelo prefixo.

A primeira linha operacional examinada está datada de 21/06/2026, embora o título declare julho. O ERP deve validar o período declarado contra as datas reais sem descartar a linha.

### Agosto de 2026

Abas:

- Detalhe;
- Resumo;
- Equipamentos.

Em 31/07/2026, agosto de 2026 ainda é um período futuro, iniciado em 01/08/2026. O arquivo deve ser tratado como modelo ou pré-lançamento, não como mês encerrado.

A primeira linha operacional examinada está datada de 21/04/2026. Também foram encontrados:

- prefixos marcados como NÃO CADASTRADO;
- primeira bomba inicial referenciando o cabeçalho Bomba final;
- resultado #VALUE! na bomba final da primeira linha;
- sequência posterior que depende do valor da linha anterior.

### Regras que devem virar domínio

- equipamento identificado por prefixo, preservando prefixo desconhecido;
- descrição e empresa derivadas do cadastro mestre;
- litros maior que zero;
- bomba final compatível com bomba inicial mais litros;
- continuidade por comboio, data e hora;
- lançamento retroativo sem misturar comboios;
- KM e horímetro opcionais conforme o tipo de equipamento;
- status de revisão, sem bloquear toda a importação;
- competência calculada pela data real, não apenas pelo nome do arquivo;
- origem e linha da importação preservadas.

O módulo de combustível existente já implementa grande parte dessas regras e deve ser a base oficial.

## 10. Relatório comercial SPMAR

Arquivo: RELATORIO_COMERCIAL_SPMAR_20-07_A_26-07.xlsx

Modificado em 29/07/2026. Período declarado de 20/07/2026 a 26/07/2026.

Aba Relatório Comercial:

- aceitante;
- CNPJ;
- gerador;
- endereço da obra;
- resíduo;
- data do descarte;
- placa;
- autorização;
- vale;
- peso líquido;
- valor unitário;
- valor;
- volume;
- pagamento.

Fórmulas:

- quantidade de registros;
- soma de peso;
- média de valor unitário;
- soma de valor.

Transformação recomendada:

- módulo de destinação ou comercial de resíduos;
- vínculo com empresa, veículo, obra e material;
- autorização e vale como documentos de negócio;
- custo ou receita por período;
- relatório semanal compatível com o formato atual.

O significado de Valor R$ deve ser confirmado operacionalmente antes de alterar a regra, pois os exemplos observados não permitem concluir com segurança se é total, tarifa ou valor por evento.

## 11. Relacionamentos entre todas as planilhas

### Equipamento e veículo

Aparecem em combustível, viagens, materiais, estacas, parte diária e cadastro SGE.

Chave atual mais comum:

- prefixo para equipamento;
- placa para veículo.

Modelo alvo:

- UUID interno;
- prefixo e placa como chaves de negócio únicas por empresa e período;
- tabela de identificadores externos.

### Colaborador

Aparece em efetivo, presença, parte diária, operação de equipamento, responsáveis e lideranças.

Modelo alvo:

- colaborador mestre;
- matrícula por vínculo;
- lotação e liderança com vigência.

### Empresa

Aparece como proprietária, contratada, fornecedora, transportadora, cliente e geradora.

Modelo alvo:

- empresa única;
- papéis múltiplos;
- CNPJ único quando informado.

### Material

Aparece em materiais, viagens, estacas, parte diária, descarte e relatórios.

Modelo alvo:

- material mestre;
- aliases de importação;
- unidade padrão;
- conversões versionadas;
- especializações para siderúrgicos e resíduos.

### Local e ramo

Aparecem como origem, destino, obra, jazida, bota-fora, canteiro, frente, ramo e estaca.

Modelo alvo:

- local hierárquico;
- ramo ou trecho vinculado a local;
- aliases para textos antigos.

### Documento operacional

Ticket, nota fiscal, autorização, vale e parte diária são identificadores de processos diferentes e não devem compartilhar uma coluna genérica.

## 12. Retrabalho atual

- cadastrar o mesmo equipamento em várias planilhas;
- buscar descrição e empresa por fórmulas repetidas;
- digitar placa, fornecedor e destino em cada linha;
- manter uma aba por tipo de material;
- manter arquivos mensais de combustível;
- conferir manualmente liberação e recebimento;
- reconstruir indicadores com intervalos fixos;
- duplicar fórmulas até a última linha do Excel;
- reconciliar arquivos principal e backup;
- corrigir #REF! sem trilha de auditoria.

## 13. Mapa planilha → módulo

- Planilha Mestre → Cadastros, importação histórica e painel.
- Controle de Estacas → Estacas e estoque siderúrgico.
- Materiais por ramo → Materiais, logística e custos.
- Viagens Jazida → Viagens e tickets.
- Efetivo Obra → Colaboradores, efetivo e presença.
- Equipamentos Alto Tietê → Equipamentos, mobilização e parte diária.
- Combustível mensal → Combustível e integrações.
- Relatório Comercial SPMAR → Destinação, comercial e relatórios.

## 14. Critério de preservação

Durante a migração, todo importador deverá guardar:

- arquivo de origem;
- aba;
- linha;
- valor original;
- valor normalizado;
- alertas;
- decisão do usuário;
- data da importação;
- usuário responsável.

Registros inválidos ou desconhecidos devem entrar em uma fila de revisão. Nunca devem desaparecer por filtro silencioso.


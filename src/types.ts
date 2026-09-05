/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  responsavel: string;
  tipos?: Array<'EMPRESA' | 'FORNECEDOR' | 'GERADOR' | 'ACEITANTE' | 'TRANSPORTADORA'>;
  status?: 'ATIVO' | 'INATIVO';
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface ObraLocal {
  id: string;
  nome: string;
  endereco: string;
  responsavel: string;
  status: 'Ativa' | 'Concluída' | 'Planejada';
}

export interface Equipamento {
  id: string;
  prefixo: string; // Prefixo da frota
  nome: string; // Nome/descrição
  tipo: string; // Tipo do equipamento (ex: Escavadeira, Caminhão, etc.)
  marca: string;
  modelo: string;
  seriePlaca: string;
  placa?: string;
  /** Ano de fabricação, quando informado no cadastro. */
  ano?: number;
  empresaId: string; // Empresa do equipamento
  status: 'Ativo' | 'Parado' | 'Manutenção' | 'Mobilizado' | 'Desmobilizado' | 'Esperando motorista';
  localAtualId: string; // Obra/local atual
  observacao: string;
  foto?: string; // Imagem do equipamento em base64 (data URL)
  horasDisponiveis?: number; // Horas que o equipamento ficou disponível para operar no período
  horasIndisponiveis?: number; // Horas que o equipamento ficou indisponível (quebrado/manutenção) no período
  categoriaFrota?: 'Equipamento' | 'Veículo' | 'Implemento';
  codigoSge?: string;
  familia?: string;
  mobilizado?: boolean;
  metaDisponibilidade?: number;
  dataMobilizacao?: string;
  dataDesmobilizacao?: string;
  operadorResponsavelId?: string;
  operadorResponsavelNome?: string;
  combustivelId?: string;
  capacidadeTanqueLitros?: number;
  equipamentoVinculadoId?: string;
}

export interface Funcionario {
  id: string;
  matricula?: string;
  nome: string;
  cargo: string;
  telefone: string;
  empresaId: string;
  ativo: boolean;
  liderMatricula?: string;
  liderNome?: string;
  area?: string;
  responsavelArea?: string;
  divisao?: string;
  secao?: string;
  status?: 'ATIVO' | 'INATIVO' | 'FÉRIAS' | 'AFASTADO' | 'DESMOBILIZADO';
  dataMobilizacao?: string;
  dataDesmobilizacao?: string;
  situacaoRh?: string;
  observacao?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Comboio {
  id: string;
  nome: string; // Nome/Identificação do comboio
  placa: string;
  capacidadeLitros: number;
  responsavel: string;
}

export interface TipoCombustivel {
  id: string;
  nome: string; // ex: Diesel S10, Diesel S500, Gasolina, etc.
}

export interface ProdutoLubrificacao {
  id: string;
  nome: string; // ex: Graxa, 68T, 15W40, etc.
}

export interface EtapaServico {
  id: string;
  nome: string; // ex: Terraplenagem, Drenagem, Pavimentação, etc.
}

export type StatusRegistroCombustivel =
  | 'OK'
  | 'Cancelado'
  | 'Pendente'
  | 'Duplicado'
  | 'Verificar quantidade'
  | 'Verificar bomba'
  | 'Verificar horímetro'
  | 'Verificar KM'
  | 'Verificar sequência'
  | 'Consumo fora do padrão'
  | 'Conferência necessária'
  | 'Erro de importação';

export type OrigemRegistroCombustivel = 'Manual' | 'Planilha' | 'OneDrive' | 'PDF/Foto IA' | 'Legado Access';
export type SeveridadeAlertaCombustivel = 'info' | 'aviso' | 'critico';
export type StatusRevisaoCombustivel = 'Pendente' | 'Aprovado' | 'Reaberto';

export interface AlertaCombustivel {
  codigo: string;
  campo: string;
  severidade: SeveridadeAlertaCombustivel;
  mensagem: string;
  valorEsperado?: string;
}

export interface Abastecimento {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  equipamentoId: string; // Frota (Equipamento)
  prefixoInformado?: string; // Prefixo digitado/importado quando ainda não existe cadastro de equipamento
  horimetroInicial: number;
  kmInicial: number;
  bombaInicial: number;
  quantidadeLitros: number;
  bombaFinal: number; // Auto: bombaInicial + quantidadeLitros
  tipoCombustivelId: string;
  comboioId: string;
  responsavel: string;
  /** Quem estava operando o equipamento no abastecimento. */
  operadorNome?: string;
  /** Onde abasteceu: frente de serviço, pátio ou ponto de apoio. */
  localAbastecimento?: string;
  observacao: string;
  status?: StatusRegistroCombustivel; // Opcional para não quebrar registros antigos. Padrão: 'OK'
  origem?: OrigemRegistroCombustivel;
  alertas?: AlertaCombustivel[];
  confiancaExtracao?: number;
  documentoOrigemNome?: string;
  documentoOrigemHash?: string;
  integracaoOrigemId?: string;
  integracaoArquivo?: string;
  integracaoAba?: string;
  integracaoLinha?: number;
  camposRevisados?: string[];
  competencia?: string; // YYYY-MM, sempre derivada da data real do lançamento
  custoLitro?: number;
  custoTotal?: number;
  capacidadeTanqueLitros?: number;
  percentualTanque?: number;
  revisaoStatus?: StatusRevisaoCombustivel;
  revisaoObservacao?: string;
  revisadoPor?: string;
  revisadoEm?: string;
  criadoEm?: string; // ISO timestamp
  atualizadoEm?: string; // ISO timestamp
}

export interface Lubrificacao {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  equipamentoId: string; // Frota (Equipamento)
  horimetro: number;
  produtoLubrificacaoId: string; // Graxa, 68T, 15W40 ou outro
  compartimento: string; // ex: Motor, Hidráulico, Transmissão
  quantidade: number; // Litros ou kg
  responsavel: string;
  observacao: string;
  status?: StatusRegistroCombustivel;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface HistoryLog {
  id: string;
  timestamp: string; // Data e hora da alteração
  usuario: string; // admin
  acao: 'Criou' | 'Editou' | 'Excluiu' | 'Inativou' | 'Desmobilizou' | 'Sincronizou';
  tela: string; // ex: Empresas, Abastecimentos, etc.
  descricao: string; // Detalhes legíveis por humanos
  registroId?: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  tipoOperacao?: 'CREATE' | 'UPDATE' | 'INACTIVATE' | 'DEMOBILIZE' | 'SYNC' | 'DELETE';
}

export interface PresencaItem {
  funcionarioId: string;
  presente: boolean;
  observacao?: string;
}

export interface ListaPresenca {
  id: string;
  data: string; // YYYY-MM-DD
  obraId: string;
  responsavel: string;
  funcionarios: PresencaItem[];
  observacoes?: string;
}

export type PresencaStatus =
  | 'Presente'
  | 'Ausente'
  | 'Falta justificada'
  | 'Atestado'
  | 'Férias'
  | 'Afastado'
  | 'Outro';

export interface GrupoEquipe {
  id: string;
  nome: string;
  responsavel: string;
  /** Matrícula do encarregado; chave estável do vínculo vindo do efetivo. */
  liderMatricula?: string;
  frenteServico: string;
  obraId?: string;
  funcionarioIds: string[];
  funcionarioMatriculas?: string[];
  status: 'ativo' | 'inativo';
  token: string;
  tokenGeral?: string;
  linkAtivo: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Colaborador do efetivo ativo que ainda não está em nenhuma equipe do link
 * público. O apontador escolhe daqui para incluir alguém que chegou na frente
 * de serviço. É um recorte propositalmente pobre do cadastro: sem telefone,
 * sem vínculo hierárquico e sem datas.
 */
export interface FuncionarioDisponivel {
  id: string;
  nome: string;
  cargo: string;
  matricula: string;
  empresaId: string;
}

export interface HistoricoEdicaoPresencaLink {
  statusAnterior: string;
  statusNovo: PresencaStatus;
  observacaoAnterior: string;
  observacaoNova: string;
  editadoEm: string;
  origem: string;
}

export interface PresencaApontamento {
  id: string;
  /** Observação do dia inteiro da equipe (chuva, parada de frente). */
  observacaoDia?: string;
  data: string; // YYYY-MM-DD
  horaEnvio: string; // HH:MM
  grupoId: string;
  grupoNome: string;
  responsavel: string;
  frenteServico: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcao: string;
  status: PresencaStatus;
  observacao: string;
  tokenUsado: string;
  createdAt: string;
  submissionDocId?: string;
  updatedAt?: string;
  atualizadoPor?: string;
  motivoAlteracao?: string;
  historicoEdicoes?: HistoricoEdicaoPresencaLink[];
}

export interface HistoricoPresenca {
  id: string;
  presencaId: string;
  grupoId: string;
  funcionarioId: string;
  data: string;
  editadoPor: string;
  editadoEm: string;
  motivo: string;
  valorAnterior: string;
  valorNovo: string;
}

export type TipoMaterialJazida =
  | 'Solo' | 'Rachão' | 'BGS' | 'Brita' | 'Areia' | 'Argila' | 'Mataco' | 'Solo mole' | 'Outros'
  | (string & {});

export type DestinoObraJazida =
  | 'Marginal' | 'Ramo 500' | 'Ramo 600' | 'Ramo 900' | 'Ramo 200' | 'Ramo 300' | 'Ramo 2000'
  | 'Agulha' | 'Ramo 800' | 'Ramo 200 Alargamento' | 'Ramo 500 Marginal' | 'Ramo 1000'
  | 'Ramo 600 Ferradura' | 'Rua Padre Eustáquio' | 'Padre Eustáquio' | 'SP066 Ibar'
  | 'Canteiro da Marginal' | 'Ferradura' | 'Coluna de Brita' | 'Apoio' | 'Jazida' | 'Outros'
  | (string & {});

export type EmpresaTicketJazida = 'RENEA' | 'Terceiro' | 'Outros';
export type TipoTicketJazida = 'Liberação' | 'Recebimento';
export type StatusFluxoTicket = 'Rascunho' | 'Enviado';
export type UnidadeQuantidadeTicket = 'm³' | 'caçamba';
export type TipoEventoTicket = 'Liberação' | 'Recebimento' | 'Devolução' | 'Impressão' | 'Cancelamento';

export interface EventoTicket {
  id: string;
  tipo: TipoEventoTicket;
  ocorridoEm: string;
  responsavel?: string;
  origem?: 'Link' | 'Admin' | 'Importação' | 'Sistema';
  observacao?: string;
}

export interface TicketJazida {
  id: string;
  data: string; // YYYY-MM-DD
  tipoTicket?: TipoTicketJazida;
  ticketNumero: string;
  prefixo: string;
  placa: string;
  familiaEquipamento?: string;
  equipamentoNome?: string;
  horaChegada?: string; // HH:MM
  horaSaida: string; // HH:MM
  tipoMaterial: TipoMaterialJazida;
  quantidadeM3: number;
  destinoObra: DestinoObraJazida;
  destinoOutro?: string;
  estaca?: string;
  responsavelLiberacao: string;
  nomeLegivel: string;
  empresa: EmpresaTicketJazida;
  observacao: string;
  status?: StatusRegistroCombustivel;
  statusFluxo?: StatusFluxoTicket;
  unidadeQuantidade?: UnidadeQuantidadeTicket;
  cargaConforme?: boolean;
  assinaturaDigital?: string;
  assinaturaResponsavel?: string;
  materialOutro?: string;
  origemRegistro?: 'Link' | 'Admin' | 'Importação';
  dispositivoId?: string;
  enviadoEm?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  impressaoEmBranco?: boolean;
  ocultarNumeroImpressao?: boolean;
  loteImpressaoId?: string;
  loteImpressaoCriadoEm?: string;
  devolvidoEm?: string;
  conferidoPor?: string;
  notaFiscalNumero?: string;
  notaFiscalData?: string;
  notaFiscalObservacao?: string;
  equipamentoId?: string;
  materialId?: string;
  localOrigemId?: string;
  localDestinoId?: string;
  ramoId?: string;
  ticketPareadoId?: string;
  viagemId?: string;
  eventos?: EventoTicket[];
}

export interface OrdemServico {
  id: string;
  numero: string; // ex: OS-0001 (gerado automaticamente)
  equipamentoId: string;
  tipo: 'Preventiva' | 'Corretiva' | 'Preditiva' | 'Revisão';
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  descricao: string;
  status: 'Aberta' | 'Em Análise' | 'Em Andamento' | 'Aguardando Peça' | 'Concluída' | 'Cancelada';
  dataAbertura: string; // YYYY-MM-DD
  horaAbertura?: string; // HH:MM
  dataConclusao?: string; // YYYY-MM-DD
  horaConclusao?: string; // HH:MM
  responsavel: string;
  /** Oficina interna ou terceiro que executou o serviço. */
  oficina?: string;
  /** O que foi feito para liberar o equipamento. */
  solucao?: string;
  custoEstimado?: number;
  custoFinal?: number;
  observacao: string;
  motivo?: string;
  motoristaId?: string;
  motoristaNome?: string;
  horimetroEntrada?: number;
  horimetroSaida?: number;
  horasMaquina?: number;
  horasEquipamento?: number;
  horasParadas?: number;
  disponibilidadePercentual?: number;
  dataSaida?: string;
  horaSaida?: string;
  localSaida?: string;
  dataChegada?: string;
  horaChegada?: string;
  localChegada?: string;
  movimentacao?: 'Sem movimentação' | 'Mobilização' | 'Desmobilização';
  saiuManutencaoEm?: string;
}

export type RespostaChecklist = 'OK' | 'Atenção' | 'Não conforme' | 'Não aplicável';

export interface ItemModeloChecklist {
  id: string;
  descricao: string;
  /** Item crítico reprovado abre ordem de serviço automaticamente. */
  critico: boolean;
}

export interface ModeloChecklist {
  id: string;
  nome: string;
  /** Vazio vale para toda a frota. */
  categoria?: string;
  itens: ItemModeloChecklist[];
  atualizadoEm: string;
}

export interface ItemChecklist {
  itemId: string;
  descricao: string;
  critico: boolean;
  resposta: RespostaChecklist;
  observacao?: string;
  /** Foto em data URL, mesmo formato já usado na foto do equipamento. */
  foto?: string;
}

export interface ChecklistEquipamento {
  id: string;
  modeloId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  equipamentoId: string;
  prefixo: string;
  responsavel: string;
  itens: ItemChecklist[];
  observacao?: string;
  /** Número da OS aberta pelos itens críticos reprovados. */
  ordemServicoNumero?: string;
  criadoEm: string;
}

export type MovimentoEstaca = 'Entrada' | 'Saída' | 'Transferência' | 'Comodato';
export type StatusEstaca = 'Pendente' | 'Programado' | 'Em carregamento' | 'Carregado' | 'Entregue' | 'Cancelado';

export interface AnexoOperacional {
  path: string;
  name: string;
  contentType: string;
  size: number;
}

export interface VinculoOperadorEquipamento {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  equipamentoId: string;
  equipamentoPrefixo: string;
  inicioEm: string;
  fimEm?: string;
  status: 'ATIVO' | 'ENCERRADO';
  responsavelAlteracao: string;
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface LoteEstaca {
  id: string;
  data: string;
  hora: string;
  movimento: MovimentoEstaca;
  notaFiscal: string;
  materialCodigo: string;
  descricao: string;
  tipo: string;
  perfilModelo: string;
  comprimentoM: number;
  unidade: string;
  pesoKg: number;
  quantidadeFisica: number;
  valorUnitario: number;
  valorTotal: number;
  placaCavalo: string;
  placaCarreta: string;
  transportadora: string;
  obraLocalId?: string;
  destino: string;
  tipoCarregamento: string;
  status: StatusEstaca;
  nfConferida: boolean;
  divergenciaNF: string;
  responsavel: string;
  observacao: string;
  origem: 'Manual' | 'Planilha' | 'Documento assistido';
  anexos?: AnexoOperacional[];
  criadoEm: string;
  atualizadoEm?: string;
}

export interface CravacaoEstaca {
  id: string;
  data: string;
  item: string;
  servico: string;
  identificacao: string;
  perfil: string;
  comprimentoM: number;
  comprimentoCravadoM: number;
  sobraM: number;
  perdaM: number;
  loteId?: string;
  obraLocalId?: string;
  ramoId?: string;
  responsavel: string;
  observacao: string;
  origem: 'Manual' | 'Planilha' | 'Documento assistido';
  anexos?: AnexoOperacional[];
  criadoEm: string;
  atualizadoEm?: string;
}

export interface ControleEstacas {
  lotes: LoteEstaca[];
  cravacoes: CravacaoEstaca[];
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string; // HH:MM
  read: boolean;
  source: 'Netlify App' | 'Sistema Local' | 'Firebase Cloud';
}

export interface PeriodoArquivado {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  criadoEm: string;
  criadoPor: string;
  versao?: string;
  checksum?: string;
  status?: 'Fechado';
  resumo: Record<string, number>;
  dados: {
    abastecimentos: Abastecimento[];
    lubrificacoes: Lubrificacao[];
    ticketsJazida: TicketJazida[];
    listasPresenca: ListaPresenca[];
    ordensServico: OrdemServico[];
    presencasLink: PresencaApontamento[];
    historicoPresencas: HistoricoPresenca[];
    controleEquipamentosDiario?: ControleEquipamentoDiario[];
    estacas?: ControleEstacas;
  };
}

export type RespostaChecklistEquipamento = 'Sim' | 'Não' | 'N/A';





export type StatusControleEquipamentoDiario =
  | 'Em operação'
  | 'Disponível'
  | 'A confirmar'
  | 'Aguardando motorista'
  | 'Em manutenção'
  | 'Aguardando manutenção'
  | 'Aguardando equipamento'
  | 'Reserva'
  | 'Desmobilizado';

export interface EventoControleEquipamentoDiario {
  id: string;
  ocorridoEm: string;
  tipo: 'SAIDA_OPERACAO' | 'ENTRADA_MANUTENCAO' | 'LIBERACAO_MANUTENCAO' | 'ALTERACAO_STATUS';
  statusAnterior?: StatusControleEquipamentoDiario;
  statusNovo: StatusControleEquipamentoDiario;
  motivo?: string;
  observacao?: string;
  ordemServicoId?: string;
  /** Quem informou a mudança. Sem isso o histórico não responde "quem alterou". */
  responsavel?: string;
}

export interface AprovacaoOperacional {
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  solicitadoEm: string;
  solicitadoPor?: string;
  decididoEm?: string;
  decididoPor?: string;
  observacao?: string;
}

export interface ControleEquipamentoDiario {
  id: string;
  chave: string;
  data: string;
  funcionarioId: string;
  codigoFuncionario: string;
  nomeMotorista: string;
  equipamentoId: string;
  prefixo: string;
  familia: string;
  tipoEquipamento?: string;
  status: StatusControleEquipamentoDiario;
  horaSaida: string;
  horaEntradaManutencao: string;
  horaLiberacao: string;
  motivoManutencao?: string;
  ordemServicoId?: string;
  eventos?: EventoControleEquipamentoDiario[];
  observacao: string;
  origem: 'SISTEMA' | 'PLANILHA';
  revisao: string[];
  aprovacao?: AprovacaoOperacional;
  criadoEm: string;
  atualizadoEm: string;
}

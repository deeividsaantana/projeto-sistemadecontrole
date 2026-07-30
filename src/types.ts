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
  empresaId: string; // Empresa do equipamento
  status: 'Ativo' | 'Parado' | 'Manutenção' | 'Mobilizado' | 'Desmobilizado' | 'Esperando motorista';
  localAtualId: string; // Obra/local atual
  observacao: string;
  foto?: string; // Imagem do equipamento em base64 (data URL)
  horasDisponiveis?: number; // Horas que o equipamento ficou disponível para operar no período
  horasIndisponiveis?: number; // Horas que o equipamento ficou indisponível (quebrado/manutenção) no período
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

export type MaterialCategoria =
  | 'Agregado'
  | 'Solo'
  | 'Bota fora'
  | 'Resíduo'
  | 'Operacional'
  | 'Outros';

export type MaterialStatus = 'Conferido' | 'Pendente' | 'Divergência' | 'Cancelado';

export interface MaterialCadastro {
  id: string;
  nome: string;
  categoria: MaterialCategoria;
  unidadePadrao: string;
  densidade?: number;
  valorReferencia?: number;
  fornecedorPadrao?: string;
  status: 'Ativo' | 'Inativo';
  observacao?: string;
}

export interface MaterialRegistro {
  id: string;
  data: string; // YYYY-MM-DD
  aba: string; // aba/origem da planilha importada ou "Manual"
  material: string;
  unidade: string;
  quantidade: number;
  suporte?: number;
  fornecedor?: string;
  placa?: string;
  prefixo?: string;
  nota?: string;
  origem?: string;
  destino?: string;
  valorUnitario?: number;
  total?: number;
  volumeCacamba?: number;
  totalM3?: number;
  status?: MaterialStatus;
  observacao?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export type StatusRegistroCombustivel =
  | 'OK'
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
  observacao: string;
  status?: StatusRegistroCombustivel; // Opcional para não quebrar registros antigos. Padrão: 'OK'
  origem?: OrigemRegistroCombustivel;
  alertas?: AlertaCombustivel[];
  confiancaExtracao?: number;
  documentoOrigemNome?: string;
  documentoOrigemHash?: string;
  integracaoOrigemId?: string;
  integracaoAba?: string;
  integracaoLinha?: number;
  camposRevisados?: string[];
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

export interface RdoDiario {
  id: string;
  data: string; // YYYY-MM-DD
  empresaId: string;
  obraLocalId: string;
  etapaServicoId: string;
  servicoExecutado: string;
  quantidadeEquipe: number; // Quantidade de equipe (pessoas)
  equipamentosUtilizadosIds: string[]; // Lista de IDs de equipamentos
  statusAtividade: 'Andamento' | 'Concluído' | 'Paralisado Chuva' | 'Paralisado Quebrado';
  observacao: string;
  pendencias: string;
  proximasEtapas: string;
}

export interface HistoryLog {
  id: string;
  timestamp: string; // Data e hora da alteração
  usuario: string; // admin
  acao: 'Criou' | 'Editou' | 'Excluiu';
  tela: string; // ex: Empresas, Abastecimentos, etc.
  descricao: string; // Detalhes legíveis por humanos
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
  frenteServico: string;
  obraId?: string;
  funcionarioIds: string[];
  status: 'ativo' | 'inativo';
  token: string;
  tokenGeral?: string;
  linkAtivo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresencaApontamento {
  id: string;
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
  updatedAt?: string;
  atualizadoPor?: string;
  motivoAlteracao?: string;
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
  | 'Solo' | 'Rachão' | 'BGS' | 'Brita' | 'Areia' | 'Argila' | 'Mataco' | 'Solo mole' | 'Outros';

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
}

export interface OrdemServico {
  id: string;
  numero: string; // ex: OS-0001 (gerado automaticamente)
  equipamentoId: string;
  tipo: 'Preventiva' | 'Corretiva' | 'Preditiva' | 'Revisão';
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  descricao: string;
  status: 'Aberta' | 'Em Andamento' | 'Aguardando Peça' | 'Concluída' | 'Cancelada';
  dataAbertura: string; // YYYY-MM-DD
  dataConclusao?: string; // YYYY-MM-DD
  responsavel: string;
  custoEstimado?: number;
  custoFinal?: number;
  observacao: string;
}

export type TurnoApontamento = 'Manhã' | 'Tarde' | 'Noite';
export type ClimaApontamento = 'Chuvoso' | 'Nublado' | 'Ensolarado';
export type CondicaoApontamento = 'Praticável' | 'Impraticável';

export interface ApontamentoRamo {
  id: string;
  canteiroNome: string;
  ramoNome: string;
  responsavel: string;
  token: string;
  status: 'ativo' | 'inativo';
  linkAtivo: boolean;
  observacao?: string;
}

export interface ApontamentoQuantidadeItem {
  nome: string;
  quantidade: number;
}

export interface ApontamentoRamoRegistro {
  id: string;
  data: string;
  horaEnvio: string;
  ramoId: string;
  canteiroNome: string;
  ramoNome: string;
  empresa: string;
  responsavel: string;
  funcaoApontador: string;
  funcoes: ApontamentoQuantidadeItem[];
  equipamentos: ApontamentoQuantidadeItem[];
  clima: Record<TurnoApontamento, ClimaApontamento>;
  condicao: Record<TurnoApontamento, CondicaoApontamento>;
  descricaoAtividade: string;
  observacao: string;
  tokenUsado: string;
  createdAt: string;
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
  resumo: Record<string, number>;
  dados: {
    abastecimentos: Abastecimento[];
    lubrificacoes: Lubrificacao[];
    ticketsJazida: TicketJazida[];
    rdos: RdoDiario[];
    listasPresenca: ListaPresenca[];
    ordensServico: OrdemServico[];
    presencasLink: PresencaApontamento[];
    historicoPresencas: HistoricoPresenca[];
    apontamentoRamoRegistros: ApontamentoRamoRegistro[];
    materiaisRegistros: MaterialRegistro[];
    partesDiariasEquipamentos: ParteDiariaEquipamento[];
  };
}

export type RespostaChecklistEquipamento = 'Sim' | 'Não' | 'N/A';
export type StatusParteDiariaEquipamento = 'Conferido' | 'Pendente' | 'Com deficiência' | 'Inconsistente';
export type TipoMarcacaoParteDiaria = 'Relógio' | 'Horímetro';

export interface ParteDiariaAtividade {
  id: string;
  descricao: string;
  centroCusto: string;
  codigoPerda: string;
  tipoMarcacao: TipoMarcacaoParteDiaria;
  inicial: string;
  final: string;
  totalHoras: number;
}

export interface ParteDiariaTransporte {
  id: string;
  descricao: string;
  centroCusto: string;
  destino: string;
  materialTransportado: string;
  quantidadeViagens: number;
  equipamentoCarga: string;
}

export interface ParteDiariaChecklistItem {
  codigo: string;
  descricao: string;
  resposta: RespostaChecklistEquipamento;
  observacao?: string;
}

export interface ParteDiariaEquipamento {
  id: string;
  numero: string;
  data: string;
  obraId: string;
  obraNome: string;
  equipamentoId: string;
  prefixo: string;
  tipoEquipamento: string;
  jornada: number;
  operadorId: string;
  operadorNome: string;
  matricula: string;
  apontador: string;
  encarregado: string;
  horimetroInicial: number;
  horimetroFinal: number;
  totalHorasTrabalhadas: number;
  atividades: ParteDiariaAtividade[];
  transportes: ParteDiariaTransporte[];
  checklist: ParteDiariaChecklistItem[];
  outrosProblemas: string;
  status: StatusParteDiariaEquipamento;
  observacao: string;
  criadoEm: string;
  atualizadoEm: string;
}

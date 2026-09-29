/**
 * Quadro da frota: todos os equipamentos da obra num dia, separados pela
 * frente onde trabalharam. Sem React, para a conta ser testada sozinha.
 *
 * Nada aqui inventa estado: equipamento sem lançamento no Controle de Frotas
 * naquele dia aparece como "Sem lançamento", na coluna "Sem frente".
 */
import type { Abastecimento, ControleEquipamentoDiario, EventoControleEquipamentoDiario, Equipamento, Funcionario, GrupoEquipe, StatusControleEquipamentoDiario } from '../../types';
import type { FleetPersistedRecord } from '../../fleet/domain';
import { classifyOperationalFleet } from '../../fleet/reconciliation';
import { CANTEIROS_ATIVOS, contemTermo } from '../../utils/frenteServico';
import { inactivateEquipamento } from '../../masterData/registryCommands';

export const SEM_FRENTE = 'Sem frente';
export const SEM_CANTEIRO = 'Sem canteiro';
/** Lista fixa de reserva; a tela usa o cadastro de canteiros quando o tem. */
export const CANTEIROS: readonly string[] = CANTEIROS_ATIVOS;

export type GrupoStatus = 'operando' | 'manutencao' | 'parado' | 'sem-lancamento';

export const ROTULO_GRUPO: Record<GrupoStatus, string> = {
  operando: 'Operando',
  manutencao: 'Manutenção',
  parado: 'Parado',
  'sem-lancamento': 'Sem lançamento',
};

const GRUPO_DO_STATUS: Record<StatusControleEquipamentoDiario, GrupoStatus> = {
  'Em operação': 'operando',
  'Em manutenção': 'manutencao',
  'Aguardando manutenção': 'manutencao',
  Disponível: 'parado',
  Reserva: 'parado',
  'Aguardando motorista': 'parado',
  'Aguardando equipamento': 'parado',
  'A confirmar': 'sem-lancamento',
  Desmobilizado: 'parado',
};

/** Desenho que o cartão mostra quando o equipamento não tem foto. */
export type Silhueta = 'escavadeira' | 'rolo' | 'trator' | 'retro' | 'caminhao' | 'cavalo' | 'pipa' | 'motoniveladora' | 'carregadeira' | 'agricola' | 'implemento' | 'veiculo' | 'guindaste' | 'gerador' | 'outro';

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SILHUETAS: ReadonlyArray<[Silhueta, RegExp]> = [
  ['pipa', /pipa|tanque|comboio/],
  ['guindaste', /guindaste|grua|guincho movel/],
  ['gerador', /\bgerador\b|\bgenset\b|grupo gerador/],
  ['retro', /retro/],
  ['escavadeira', /escavadeira|escavadora|\bpc\d|ec\d/],
  ['rolo', /rolo|compactador/],
  ['motoniveladora', /motoniveladora|patrol|niveladora/],
  ['carregadeira', /carregadeira|pa carregadeira|\bpa\b/],
  ['trator', /trator de esteira|esteira|\bd\d|dozer/],
  ['agricola', /trator agricola|agricola|trator de pneu|trator/],
  ['caminhao', /caminhao|basculante|cacamba|truck|munck|prancha/],
  ['implemento', /grade|arado|implemento|reboque|carreta/],
  ['veiculo', /pickup|picape|caminhonete|carro|veiculo|onibus|van/],
];

export const silhuetaDo = (equipamento: Pick<Equipamento, 'tipo' | 'nome' | 'familia' | 'categoriaFrota'>): Silhueta => {
  // Cavalo mecânico costuma vir cadastrado com tipo "Veículo"; o nome decide antes.
  const tudo = semAcento([equipamento.tipo, equipamento.familia, equipamento.nome].filter(Boolean).join(' '));
  if (/cavalo|cavalinho|trator rodoviario/.test(tudo)) return 'cavalo';
  // O tipo manda; família e nome só entram quando o tipo não diz nada.
  for (const campo of [equipamento.tipo, equipamento.familia, equipamento.nome]) {
    if (!campo) continue;
    const texto = semAcento(campo);
    const achada = SILHUETAS.find(([, regra]) => regra.test(texto));
    if (achada) return achada[0];
  }
  return equipamento.categoriaFrota === 'Veículo' ? 'veiculo' : 'outro';
};

export interface CartaoFrota {
  equipamentoId: string;
  /** Lançamento do dia que o cartão mostra; vazio quando não houve lançamento. */
  registroId?: string;
  prefixo: string;
  modelo: string;
  marca: string;
  tipo: string;
  foto?: string;
  silhueta: Silhueta;
  canteiro: string;
  frente: string;
  status: StatusControleEquipamentoDiario | 'Sem lançamento';
  grupo: GrupoStatus;
  /** Situação veio de um lançamento de dia anterior, mantida até alguém mudar. */
  situacaoHerdada?: boolean;
  operador?: string;
  /** Maior horímetro informado nos abastecimentos até o dia do quadro. */
  horimetro?: number;
  observacao?: string;
  motivoManutencao?: string;
  atualizadoEm?: string;
}

export interface IndicadoresFrota {
  total: number;
  operando: number;
  manutencao: number;
  parado: number;
  semLancamento: number;
  /** Lançados no dia que não estão em manutenção, sobre os lançados. Sem lançamento não entra na conta. */
  disponibilidade: number | null;
  comOperador: number;
  semOperador: number;
}

type RegistroDoDia = ControleEquipamentoDiario & { frenteServico?: string; local?: string; equipeId?: string; excluido?: unknown };

/** Outros jeitos de escrever um canteiro fixo que aparecem nos lançamentos e nas equipes. */
const APELIDOS: Record<string, readonly string[]> = {
  'SP-066': ['SP066', 'SP66', 'SP-66'],
  'Pátio Aracaré': ['Aracaré', 'Aracare', 'Pátio de Vigas Aracaré', 'Pátio para Viga Aracaré'],
};

/** Primeiro canteiro citado nos textos, na ordem em que vêm. */
const canteiroNoTexto = (canteiros: readonly string[], ...textos: Array<string | undefined>): string | undefined => {
  for (const texto of textos) {
    if (!texto) continue;
    const achado = canteiros.find(canteiro => [canteiro, ...(APELIDOS[canteiro] || [])].some(nome => contemTermo(texto, nome)));
    if (achado) return achado;
  }
  return undefined;
};

export interface EntradaQuadro {
  dia: string;
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  gruposEquipe: readonly GrupoEquipe[];
  abastecimentos: readonly Abastecimento[];
  /** Canteiros do cadastro; sem isso usa a lista fixa (testes e telas antigas). */
  canteiros?: readonly string[];
}

const comparar = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }).compare;

export const montarQuadro = ({ dia, equipamentos, registros, gruposEquipe, abastecimentos, canteiros = CANTEIROS }: EntradaQuadro): CartaoFrota[] => {
  // Último lançamento do dia de cada equipamento (o mais recente vale).
  const doDia = new Map<string, RegistroDoDia>();
  (registros as readonly RegistroDoDia[]).forEach(registro => {
    if (registro.data !== dia || registro.excluido) return;
    const atual = doDia.get(registro.equipamentoId);
    if (!atual || (registro.atualizadoEm || '') > (atual.atualizadoEm || '')) doDia.set(registro.equipamentoId, registro);
  });

  // Canteiro escolhido à mão num dia vale para os dias seguintes, até mudar.
  const ultimoLocal = new Map<string, { data: string; local: string }>();
  (registros as readonly RegistroDoDia[]).forEach(registro => {
    if (registro.excluido || !registro.local || registro.data > dia) return;
    const atual = ultimoLocal.get(registro.equipamentoId);
    if (!atual || registro.data > atual.data) ultimoLocal.set(registro.equipamentoId, { data: registro.data, local: registro.local });
  });

  // Situação lançada à mão também vale para os dias seguintes, até mudar: sem
  // lançamento novo, a máquina mantém a última situação em vez de voltar para
  // "Sem lançamento" todo dia.
  const ultimoRegistro = new Map<string, RegistroDoDia>();
  (registros as readonly RegistroDoDia[]).forEach(registro => {
    if (registro.excluido || registro.data > dia) return;
    const atual = ultimoRegistro.get(registro.equipamentoId);
    if (!atual || registro.data > atual.data || (registro.data === atual.data && (registro.atualizadoEm || '') > (atual.atualizadoEm || ''))) {
      ultimoRegistro.set(registro.equipamentoId, registro);
    }
  });

  const horimetros = new Map<string, number>();
  abastecimentos.forEach(item => {
    if (!item.equipamentoId || item.data > dia || !Number.isFinite(item.horimetroInicial) || item.horimetroInicial <= 0) return;
    horimetros.set(item.equipamentoId, Math.max(horimetros.get(item.equipamentoId) ?? 0, item.horimetroInicial));
  });

  const equipes = new Map(gruposEquipe.map(grupo => [grupo.id, grupo]));

  return equipamentos
    // Desmobilizado sem lançamento no dia não está mais na obra.
    .filter(item => item.status !== 'Desmobilizado' || doDia.has(item.id))
    .map((item): CartaoFrota => {
      const registro = doDia.get(item.id);
      const herdado = registro ? undefined : ultimoRegistro.get(item.id);
      const base = registro || herdado;
      const equipe = registro?.equipeId ? equipes.get(registro.equipeId) : undefined;
      const frente = (registro?.frenteServico || equipe?.frenteServico || '').trim() || SEM_FRENTE;
      const canteiro = canteiroNoTexto(canteiros, registro?.local, ultimoLocal.get(item.id)?.local, registro?.frenteServico, equipe?.frenteServico, equipe?.nome) || SEM_CANTEIRO;
      const operador = (base?.nomeMotorista || item.operadorResponsavelNome || '').trim() || undefined;
      return {
        equipamentoId: item.id,
        registroId: registro?.id,
        prefixo: item.prefixo,
        modelo: [item.marca, item.modelo].filter(Boolean).join(' ') || item.nome,
        marca: (item.marca || '').trim(),
        tipo: item.tipo || 'Outro',
        foto: item.foto || undefined,
        silhueta: silhuetaDo(item),
        canteiro,
        frente,
        status: base ? base.status : 'Sem lançamento',
        grupo: base ? GRUPO_DO_STATUS[base.status] ?? 'parado' : 'sem-lancamento',
        situacaoHerdada: Boolean(herdado),
        operador,
        horimetro: horimetros.get(item.id),
        observacao: registro?.observacao || herdado?.observacao || undefined,
        motivoManutencao: base?.motivoManutencao || undefined,
        atualizadoEm: base?.atualizadoEm,
      };
    })
    .sort((a, b) => comparar(a.prefixo, b.prefixo));
};

export const calcularIndicadores = (cartoes: readonly CartaoFrota[]): IndicadoresFrota => {
  const conta = (grupo: GrupoStatus) => cartoes.filter(item => item.grupo === grupo).length;
  const semLancamento = conta('sem-lancamento');
  const manutencao = conta('manutencao');
  const lancados = cartoes.length - semLancamento;
  const comOperador = cartoes.filter(item => item.operador).length;
  return {
    total: cartoes.length,
    operando: conta('operando'),
    manutencao,
    parado: conta('parado'),
    semLancamento,
    disponibilidade: lancados > 0 ? Math.round(((lancados - manutencao) / lancados) * 100) : null,
    comOperador,
    semOperador: cartoes.length - comOperador,
  };
};

export interface GrupoCanteiro {
  canteiro: string;
  cartoes: CartaoFrota[];
  operando: number;
  manutencao: number;
}

/** Um bloco por canteiro ativo, na ordem da obra, e "Sem canteiro" no fim quando tiver máquina. */
export const agruparPorCanteiro = (cartoes: readonly CartaoFrota[], mostrarVazios = true, canteiros: readonly string[] = CANTEIROS): GrupoCanteiro[] => {
  const grupos = new Map<string, CartaoFrota[]>([...canteiros, SEM_CANTEIRO].map(nome => [nome, []]));
  cartoes.forEach(cartao => (grupos.get(cartao.canteiro) || grupos.get(SEM_CANTEIRO))!.push(cartao));
  return Array.from(grupos, ([canteiro, lista]) => ({
    canteiro,
    cartoes: lista,
    operando: lista.filter(item => item.grupo === 'operando').length,
    manutencao: lista.filter(item => item.grupo === 'manutencao').length,
  })).filter(grupo => grupo.cartoes.length > 0 || (mostrarVazios && grupo.canteiro !== SEM_CANTEIRO));
};

export type Ordem = 'prefixo' | 'situacao' | 'horimetro-maior' | 'horimetro-menor' | 'operador';

export const ROTULO_ORDEM: Record<Ordem, string> = {
  prefixo: 'Prefixo',
  situacao: 'Situação',
  'horimetro-maior': 'Maior horímetro',
  'horimetro-menor': 'Menor horímetro',
  operador: 'Operador',
};

export interface FiltrosQuadro {
  canteiro: string;
  frente: string;
  grupo: GrupoStatus | '';
  tipo: string;
  marca: string;
  operador: '' | 'com' | 'sem';
  foto: '' | 'com' | 'sem';
  horimetro: '' | 'com' | 'sem';
  busca: string;
}

export const FILTROS_VAZIOS: FiltrosQuadro = { canteiro: '', frente: '', grupo: '', tipo: '', marca: '', operador: '', foto: '', horimetro: '', busca: '' };

const ORDEM_GRUPO: Record<GrupoStatus, number> = { manutencao: 0, parado: 1, 'sem-lancamento': 2, operando: 3 };

const comOuSem = (filtro: '' | 'com' | 'sem', tem: boolean) => !filtro || (filtro === 'com') === tem;

export const filtrarCartoes = (cartoes: readonly CartaoFrota[], filtros: FiltrosQuadro, ordem: Ordem = 'prefixo'): CartaoFrota[] => {
  const termos = semAcento(filtros.busca).split(/\s+/).filter(Boolean);
  const lista = cartoes.filter(cartao => {
    if (filtros.canteiro && cartao.canteiro !== filtros.canteiro) return false;
    if (filtros.frente && cartao.frente !== filtros.frente) return false;
    if (filtros.grupo && cartao.grupo !== filtros.grupo) return false;
    if (filtros.tipo && cartao.tipo !== filtros.tipo) return false;
    if (filtros.marca && cartao.marca !== filtros.marca) return false;
    if (!comOuSem(filtros.operador, Boolean(cartao.operador))) return false;
    if (!comOuSem(filtros.foto, Boolean(cartao.foto))) return false;
    if (!comOuSem(filtros.horimetro, Boolean(cartao.horimetro))) return false;
    if (termos.length === 0) return true;
    const texto = semAcento([cartao.prefixo, cartao.modelo, cartao.tipo, cartao.operador, cartao.frente, cartao.canteiro].filter(Boolean).join(' '));
    return termos.every(termo => texto.includes(termo));
  });
  if (ordem === 'prefixo') return lista;
  // Sem horímetro vai para o fim nas duas ordens de horímetro: não é zero, é falta de dado.
  const horas = (item: CartaoFrota, sinal: number) => (item.horimetro === undefined ? Number.POSITIVE_INFINITY : sinal * item.horimetro);
  const criterio: Record<Exclude<Ordem, 'prefixo'>, (a: CartaoFrota, b: CartaoFrota) => number> = {
    situacao: (a, b) => ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo],
    'horimetro-maior': (a, b) => horas(a, -1) - horas(b, -1),
    'horimetro-menor': (a, b) => horas(a, 1) - horas(b, 1),
    operador: (a, b) => (a.operador ? 0 : 1) - (b.operador ? 0 : 1) || comparar(a.operador || '', b.operador || ''),
  };
  return [...lista].sort((a, b) => criterio[ordem](a, b) || comparar(a.prefixo, b.prefixo));
};

/** Etiquetas dos filtros ligados, para mostrar e tirar um por um. */
export const etiquetasDosFiltros = (filtros: FiltrosQuadro): Array<{ chave: keyof FiltrosQuadro; texto: string }> => {
  const saida: Array<{ chave: keyof FiltrosQuadro; texto: string }> = [];
  if (filtros.busca.trim()) saida.push({ chave: 'busca', texto: `Busca: ${filtros.busca.trim()}` });
  if (filtros.canteiro) saida.push({ chave: 'canteiro', texto: `Canteiro: ${filtros.canteiro}` });
  if (filtros.frente) saida.push({ chave: 'frente', texto: `Frente: ${filtros.frente}` });
  if (filtros.grupo) saida.push({ chave: 'grupo', texto: ROTULO_GRUPO[filtros.grupo] });
  if (filtros.tipo) saida.push({ chave: 'tipo', texto: `Tipo: ${filtros.tipo}` });
  if (filtros.marca) saida.push({ chave: 'marca', texto: `Marca: ${filtros.marca}` });
  if (filtros.operador) saida.push({ chave: 'operador', texto: filtros.operador === 'com' ? 'Com operador' : 'Sem operador' });
  if (filtros.foto) saida.push({ chave: 'foto', texto: filtros.foto === 'com' ? 'Com foto' : 'Sem foto' });
  if (filtros.horimetro) saida.push({ chave: 'horimetro', texto: filtros.horimetro === 'com' ? 'Com horímetro' : 'Sem horímetro' });
  return saida;
};

/** Situações que o quadro deixa escolher, na ordem em que aparecem no detalhe. */
export const SITUACOES_EDITAVEIS: readonly StatusControleEquipamentoDiario[] = [
  'Em operação',
  'Disponível',
  'Aguardando motorista',
  'Aguardando equipamento',
  'Reserva',
  'Em manutenção',
  'Aguardando manutenção',
];

const EM_MANUTENCAO: ReadonlySet<StatusControleEquipamentoDiario> = new Set(['Em manutenção', 'Aguardando manutenção']);

export interface EdicaoQuadro {
  status: StatusControleEquipamentoDiario;
  /** Um dos canteiros ativos, ou vazio. Grava em `local` do lançamento. */
  canteiro: string;
  frente: string;
  operador: string;
  motivoManutencao: string;
  observacao: string;
}

export interface EntradaEdicao {
  dia: string;
  /** Hora local HH:MM de agora, para preencher saída, entrada e liberação da manutenção. */
  hora: string;
  agora: string;
  usuario: string;
  equipamento: Equipamento;
  registros: readonly ControleEquipamentoDiario[];
  funcionarios: readonly Funcionario[];
  edicao: EdicaoQuadro;
}

export type ResultadoEdicao =
  | { ok: true; registro: FleetPersistedRecord; novo: boolean }
  | { ok: false; erro: string };

/**
 * Monta o lançamento do dia a partir do que foi mudado no quadro, no mesmo
 * formato que o Controle de Frotas grava: mesma chave, histórico de eventos e
 * aprovação pendente. Operador digitado que não bate com um colaborador fica
 * como motorista temporário, igual ao formulário da frota.
 */
export const registroDaEdicao = ({ dia, hora, agora, usuario, equipamento, registros, funcionarios, edicao }: EntradaEdicao): ResultadoEdicao => {
  const operador = edicao.operador.trim();
  const motivo = edicao.motivoManutencao.trim();
  if (edicao.status === 'Em operação' && !operador) return { ok: false, erro: 'Para ficar Em operação, informe o operador.' };
  if (EM_MANUTENCAO.has(edicao.status) && !motivo) return { ok: false, erro: 'Informe o motivo da manutenção.' };

  const chave = `${dia}|${equipamento.id}`;
  const existente = (registros as readonly FleetPersistedRecord[])
    .filter(item => !item.excluido && (item.chave === chave || (item.data === dia && item.equipamentoId === equipamento.id)))
    .sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''))[0];

  const alvo = semAcento(operador);
  const funcionario = operador ? funcionarios.find(item => item.ativo !== false && semAcento(item.nome.trim()) === alvo) : undefined;
  const temporario = Boolean(operador && !funcionario);
  const anterior = existente?.status;
  const entrouNaManutencao = EM_MANUTENCAO.has(edicao.status);
  const saiuDaManutencao = Boolean(anterior && EM_MANUTENCAO.has(anterior) && !entrouNaManutencao);
  const tipo: EventoControleEquipamentoDiario['tipo'] = entrouNaManutencao
    ? 'ENTRADA_MANUTENCAO'
    : saiuDaManutencao ? 'LIBERACAO_MANUTENCAO' : edicao.status === 'Em operação' ? 'SAIDA_OPERACAO' : 'ALTERACAO_STATUS';
  const classificacao = classifyOperationalFleet(equipamento);

  const registro: FleetPersistedRecord = {
    ...existente,
    id: existente?.id || `cfd-${dia}-${equipamento.id}`,
    chave: existente?.chave || chave,
    data: dia,
    funcionarioId: funcionario?.id || '',
    codigoFuncionario: funcionario?.matricula || '',
    nomeMotorista: funcionario?.nome || operador,
    equipamentoId: equipamento.id,
    prefixo: equipamento.prefixo,
    familia: existente?.familia || classificacao.group,
    tipoEquipamento: existente?.tipoEquipamento || classificacao.equipmentType,
    status: edicao.status,
    horaSaida: existente?.horaSaida || (edicao.status === 'Em operação' ? hora : ''),
    horaEntradaManutencao: entrouNaManutencao ? existente?.horaEntradaManutencao || hora : existente?.horaEntradaManutencao || '',
    horaLiberacao: saiuDaManutencao ? hora : existente?.horaLiberacao || '',
    motivoManutencao: entrouNaManutencao ? motivo : existente?.motivoManutencao,
    observacao: edicao.observacao.trim(),
    frenteServico: edicao.frente.trim() || undefined,
    local: edicao.canteiro.trim() || undefined,
    origem: existente?.origem || 'SISTEMA',
    revisao: temporario ? ['Motorista temporário requer cadastro/vínculo.'] : [],
    motoristaTemporario: temporario,
    aprovacao: existente?.aprovacao || { status: 'PENDENTE', solicitadoEm: agora, solicitadoPor: usuario },
    eventos: [...(existente?.eventos || []), {
      id: `evt-${agora}-${equipamento.id}`,
      ocorridoEm: agora,
      tipo,
      statusAnterior: anterior,
      statusNovo: edicao.status,
      motivo: entrouNaManutencao ? motivo : undefined,
      observacao: edicao.observacao.trim() || undefined,
      responsavel: usuario,
    }],
    criadoEm: existente?.criadoEm || agora,
    atualizadoEm: agora,
    criadoPor: existente?.criadoPor || usuario,
    atualizadoPor: usuario,
  };
  return { ok: true, registro, novo: !existente };
};

/** Rascunho da edição na tela: a situação pode ficar em branco até a pessoa escolher. */
export type RascunhoQuadro = Omit<EdicaoQuadro, 'status'> & { status: StatusControleEquipamentoDiario | '' };

/** O que já está gravado para a máquina no dia; sem lançamento, a situação começa em branco. */
export const rascunhoDoCartao = (cartao: CartaoFrota): RascunhoQuadro => ({
  status: cartao.status === 'Sem lançamento' || cartao.status === 'A confirmar' || cartao.status === 'Desmobilizado' ? '' : cartao.status,
  canteiro: cartao.canteiro === SEM_CANTEIRO ? '' : cartao.canteiro,
  frente: cartao.frente === SEM_FRENTE ? '' : cartao.frente,
  operador: cartao.operador || '',
  motivoManutencao: cartao.motivoManutencao || '',
  observacao: cartao.observacao || '',
});

export const rascunhoMudou = (a: RascunhoQuadro, b: RascunhoQuadro) =>
  (Object.keys(a) as Array<keyof RascunhoQuadro>).some(chave => a[chave].trim() !== b[chave].trim());

export interface EntradaLote extends Omit<EntradaEdicao, 'equipamento' | 'edicao'> {
  equipamentos: readonly Equipamento[];
  rascunhos: ReadonlyArray<{ equipamentoId: string; rascunho: RascunhoQuadro }>;
}

/**
 * Monta os lançamentos de várias máquinas de uma vez. O que tem problema
 * (sem situação, sem operador, sem motivo) volta em `erros` e não é gravado;
 * o resto segue.
 */
export const lancarEmLote = ({ equipamentos, rascunhos, ...resto }: EntradaLote) => {
  const porId = new Map(equipamentos.map(item => [item.id, item]));
  const prontos: Array<{ registro: FleetPersistedRecord; novo: boolean }> = [];
  const erros = new Map<string, string>();
  rascunhos.forEach(({ equipamentoId, rascunho }) => {
    const equipamento = porId.get(equipamentoId);
    if (!equipamento) return erros.set(equipamentoId, 'Esta máquina não está mais no cadastro.');
    if (!rascunho.status) return erros.set(equipamentoId, 'Escolha a situação.');
    const resultado = registroDaEdicao({ ...resto, equipamento, edicao: { ...rascunho, status: rascunho.status } });
    if ('erro' in resultado) return erros.set(equipamentoId, resultado.erro);
    prontos.push({ registro: resultado.registro, novo: resultado.novo });
    return undefined;
  });
  return { prontos, erros };
};

/**
 * Rascunho copiado do último dia lançado antes de `dia`, para cada máquina
 * pedida. Serve ao botão "Repetir último dia": a pessoa confere e salva.
 * Máquina sem nenhum lançamento anterior fica de fora.
 */
export const rascunhosDoUltimoDia = (registros: readonly ControleEquipamentoDiario[], equipamentoIds: readonly string[], dia: string, canteiros: readonly string[] = CANTEIROS) => {
  const pedidos = new Set(equipamentoIds);
  const ultimo = new Map<string, RegistroDoDia>();
  (registros as readonly RegistroDoDia[]).forEach(registro => {
    if (registro.excluido || registro.data >= dia || !pedidos.has(registro.equipamentoId)) return;
    const atual = ultimo.get(registro.equipamentoId);
    if (!atual || registro.data > atual.data || (registro.data === atual.data && (registro.atualizadoEm || '') > (atual.atualizadoEm || ''))) ultimo.set(registro.equipamentoId, registro);
  });
  const saida = new Map<string, RascunhoQuadro>();
  ultimo.forEach((registro, equipamentoId) => {
    saida.set(equipamentoId, {
      status: SITUACOES_EDITAVEIS.includes(registro.status) ? registro.status : '',
      canteiro: canteiroNoTexto(canteiros, registro.local, registro.frenteServico) || '',
      frente: (registro.frenteServico || '').trim(),
      operador: (registro.nomeMotorista || '').trim(),
      motivoManutencao: registro.motivoManutencao || '',
      observacao: '',
    });
  });
  return saida;
};

export interface RemocaoQuadro {
  /** Equipamentos desmobilizados, para a mensagem/histórico. */
  alvos: Equipamento[];
  equipamentosAtualizados: Equipamento[];
  registrosAtualizados: ControleEquipamentoDiario[];
}

/**
 * "Remover do quadro" desmobiliza a máquina (some do quadro pra sempre, mas
 * fica no cadastro e no histórico) e apaga o lançamento do dia que a
 * mantinha visível hoje, se tiver algum.
 */
export const removerEquipamentosDoQuadro = (
  equipamentos: readonly Equipamento[],
  registros: readonly ControleEquipamentoDiario[],
  itens: ReadonlyArray<{ equipamentoId: string; registroId?: string }>,
): RemocaoQuadro => {
  const equipamentoIds = new Set(itens.map(item => item.equipamentoId));
  const alvos = equipamentos.filter(item => equipamentoIds.has(item.id) && item.status !== 'Desmobilizado');
  const equipamentosAtualizados = equipamentos.map(item => (equipamentoIds.has(item.id) ? inactivateEquipamento(item) : item));
  const registroIds = new Set(itens.map(item => item.registroId).filter((id): id is string => Boolean(id)));
  const registrosAtualizados = registroIds.size ? registros.filter(item => !registroIds.has(item.id)) : [...registros];
  return { alvos, equipamentosAtualizados, registrosAtualizados };
};

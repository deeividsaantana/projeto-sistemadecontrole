import type {
  DocumentoArquivo,
  Equipamento,
  FichaVerificacaoServico,
  FrenteServico,
  Funcionario,
  Inspecao,
  Material,
  Medicao,
  NaoConformidade,
  ObraLocal,
  Ocorrencia,
  OrdemServico,
  ServicoObra,
  TicketJazida,
} from '../types';
import { normalizeComparable } from './canonicalIdentity';

export interface ResultadoBusca {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo?: string;
  /** Tela onde o registro vive. A busca leva para lá, não duplica o dado. */
  tab: string;
}

export interface FontesBusca {
  equipamentos?: Equipamento[];
  funcionarios?: Funcionario[];
  obras?: ObraLocal[];
  frentes?: FrenteServico[];
  servicos?: ServicoObra[];
  materiais?: Material[];
  ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[];
  fichasFvs?: FichaVerificacaoServico[];
  inspecoes?: Inspecao[];
  naoConformidades?: NaoConformidade[];
  medicoes?: Medicao[];
  documentos?: DocumentoArquivo[];
  ocorrencias?: Ocorrencia[];
}

const LIMITE_POR_TIPO = 5;
const LIMITE_TOTAL = 30;

const combina = (termo: string, ...campos: Array<string | undefined>) =>
  normalizeComparable(campos.filter(Boolean).join(' ')).includes(termo);

/**
 * Busca por texto em todos os cadastros e registros carregados. Trabalha sobre
 * o que já está em memória — nenhuma consulta nova ao banco — e devolve o
 * caminho até a tela de origem em vez de uma cópia do registro.
 */
export const buscarGlobal = (busca: string, fontes: FontesBusca): ResultadoBusca[] => {
  const termo = normalizeComparable(busca).trim();
  if (termo.length < 2) return [];

  const grupos: Array<ResultadoBusca[]> = [
    (fontes.equipamentos || [])
      .filter(item => combina(termo, item.prefixo, item.modelo, item.tipo, item.seriePlaca))
      .map(item => ({ id: `eq-${item.id}`, tipo: 'Equipamento', titulo: item.prefixo, subtitulo: [item.tipo, item.modelo].filter(Boolean).join(' · '), tab: 'frota' })),
    (fontes.funcionarios || [])
      .filter(item => item.ativo !== false && combina(termo, item.nome, item.matricula, item.cargo))
      .map(item => ({ id: `fn-${item.id}`, tipo: 'Colaborador', titulo: item.nome, subtitulo: [item.matricula, item.cargo].filter(Boolean).join(' · '), tab: 'colaboradores' })),
    (fontes.obras || [])
      .filter(item => combina(termo, item.nome, item.endereco, item.responsavel))
      .map(item => ({ id: `ob-${item.id}`, tipo: 'Obra', titulo: item.nome, subtitulo: item.endereco, tab: 'cadastros' })),
    (fontes.frentes || [])
      .filter(item => combina(termo, item.nome, item.servico, item.ramoLocal, item.responsavel))
      .map(item => ({ id: `fr-${item.id}`, tipo: 'Frente', titulo: item.nome, subtitulo: item.servico, tab: 'frentes' })),
    (fontes.servicos || [])
      .filter(item => item.ativo !== false && combina(termo, item.descricao, item.codigo))
      .map(item => ({ id: `sv-${item.id}`, tipo: 'Serviço', titulo: item.descricao, subtitulo: item.unidade, tab: 'producao' })),
    (fontes.materiais || [])
      .filter(item => item.ativo !== false && combina(termo, item.descricao, item.codigo, item.categoria))
      .map(item => ({ id: `mt-${item.id}`, tipo: 'Material', titulo: item.descricao, subtitulo: item.categoria, tab: 'materiais' })),
    (fontes.ordensServico || [])
      .filter(item => combina(termo, item.numero, item.motivo, item.descricao, item.responsavel))
      .map(item => ({ id: `os-${item.id}`, tipo: 'Ordem de serviço', titulo: item.numero, subtitulo: [item.status, item.motivo].filter(Boolean).join(' · '), tab: 'manutencao' })),
    (fontes.ticketsJazida || [])
      .filter(item => combina(termo, item.ticketNumero, item.placa, item.motoristaNome, item.tipoMaterial, item.prefixo))
      .map(item => ({ id: `tk-${item.id}`, tipo: 'Ticket', titulo: item.ticketNumero || item.id, subtitulo: [item.data, item.placa].filter(Boolean).join(' · '), tab: 'tickets-jazida' })),
    (fontes.fichasFvs || [])
      .filter(item => item.ativo !== false && combina(termo, item.numero, item.local, item.servicoDescricao))
      .map(item => ({ id: `fvs-${item.id}`, tipo: 'FVS', titulo: item.numero, subtitulo: [item.local, item.situacao].filter(Boolean).join(' · '), tab: 'fvs' })),
    (fontes.inspecoes || [])
      .filter(item => item.ativo !== false && combina(termo, item.numero, item.local, item.descricao))
      .map(item => ({ id: `insp-${item.id}`, tipo: 'Inspeção', titulo: item.numero, subtitulo: [item.local, item.situacao].filter(Boolean).join(' · '), tab: 'inspecoes' })),
    (fontes.naoConformidades || [])
      .filter(item => item.ativo !== false && combina(termo, item.numero, item.descricao, item.local))
      .map(item => ({ id: `nc-${item.id}`, tipo: 'Não conformidade', titulo: item.numero, subtitulo: item.descricao, tab: 'nao-conformidades' })),
    (fontes.medicoes || [])
      .filter(item => item.ativo !== false && combina(termo, item.numero, item.situacao, item.responsavel))
      .map(item => ({ id: `med-${item.id}`, tipo: 'Medição', titulo: item.numero, subtitulo: `${item.periodoInicio} a ${item.periodoFim}`, tab: 'medicoes' })),
    (fontes.documentos || [])
      .filter(item => item.ativo !== false && combina(termo, item.titulo, item.numero, item.tipo))
      .map(item => ({ id: `doc-${item.id}`, tipo: 'Documento', titulo: item.titulo, subtitulo: [item.tipo, item.validade].filter(Boolean).join(' · '), tab: 'documentos' })),
    (fontes.ocorrencias || [])
      .filter(item => item.ativo !== false && combina(termo, item.numero, item.descricao, item.local, item.tipo))
      .map(item => ({ id: `oc-${item.id}`, tipo: 'Ocorrência', titulo: item.numero, subtitulo: item.descricao, tab: 'ocorrencias' })),
  ];

  return grupos.flatMap(grupo => grupo.slice(0, LIMITE_POR_TIPO)).slice(0, LIMITE_TOTAL);
};

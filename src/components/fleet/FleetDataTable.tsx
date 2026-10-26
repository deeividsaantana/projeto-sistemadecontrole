import { useMemo } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import type { FleetCurrentState } from '../../fleet/domain';
import FleetStatusBadge from './FleetStatusBadge';
import { FOCO, TOM_SITUACAO } from '../cadastros/estilos';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';

interface Props {
  rows: FleetCurrentState[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (state: FleetCurrentState) => void;
  onDetails: (state: FleetCurrentState) => void;
  /** Sem ele, não aparece Excluir. */
  onDelete?: (state: FleetCurrentState) => void;
  canApprove?: boolean;
  onApprove?: (state: FleetCurrentState, status: 'APROVADO' | 'REJEITADO') => void;
}

const observacaoDe = (row: FleetCurrentState) => [row.maintenanceReason, row.note].filter(Boolean).join('. ');

const TOM_APROVACAO = {
  APROVADO: { rotulo: 'Aprovado', tom: TOM_SITUACAO.ok },
  REJEITADO: { rotulo: 'Rejeitado', tom: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200' },
  PENDENTE: { rotulo: 'Pendente', tom: TOM_SITUACAO.alerta },
} as const;

const rotuloAprovacao = (row: FleetCurrentState) => (TOM_APROVACAO[row.approvalStatus as keyof typeof TOM_APROVACAO] ?? TOM_APROVACAO.PENDENTE).rotulo;

const seloAprovacao = (row: FleetCurrentState) => {
  const { rotulo, tom } = TOM_APROVACAO[row.approvalStatus as keyof typeof TOM_APROVACAO] ?? TOM_APROVACAO.PENDENTE;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${tom}`}>{rotulo}</span>;
};

/** Texto de uma linha só: o que não couber some com reticências e fica inteiro na dica. */
// Só na tabela (768 px ou mais): no cartão do celular o texto quebra inteiro.
const UMA_LINHA = 'block md:truncate md:whitespace-nowrap';

const ICONE = `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition duration-200 active:scale-[0.96] md:size-8 md:min-h-0 md:min-w-0 md:px-0 ${FOCO}`;

/**
 * Colunas da Situação do dia. Cada lançamento ocupa uma linha de 40 px: o
 * tipo da máquina, a matrícula e o tempo parado ficam na mesma linha do dado
 * principal, em cinza, e cada coluna tem largura máxima para a tabela caber
 * num notebook de 1366 px sem rolar para o lado. Quem aprova vê Aprovar e
 * Rejeitar na própria coluna Aprovação, no lugar do selo "Pendente".
 */
const colunas = (
  aprovar?: (row: FleetCurrentState, status: 'APROVADO' | 'REJEITADO') => void,
): ColunaTabela<FleetCurrentState>[] => [
  {
    chave: 'prefix',
    titulo: 'Máquina',
    valorOrdenacao: row => row.equipment.normalizedPrefix,
    dica: row => [row.equipment.prefix, row.equipment.family, row.equipment.equipmentType].filter(Boolean).join(' · '),
    render: row => (
      <span className={`${UMA_LINHA} md:max-w-[10rem] 2xl:max-w-[16rem]`}>
        <span className="font-mono font-bold text-slate-950">{row.equipment.prefix}</span>
        <span className="text-[#5b6870]"> · {row.equipment.equipmentType || row.equipment.family || 'Sem tipo'}</span>
      </span>
    ),
  },
  {
    chave: 'driver',
    titulo: 'Motorista',
    valorOrdenacao: row => row.driver?.employeeName || '',
    dica: row => [row.driver?.employeeName, row.driver?.employeeCode].filter(Boolean).join(' · ') || 'Sem motorista',
    render: row => row.driver?.employeeName ? (
      <span className={`${UMA_LINHA} md:max-w-[10rem] 2xl:max-w-[16rem]`}>
        <span className="font-semibold text-slate-900">{row.driver.employeeName}</span>
        {row.driver.employeeCode && <span className="font-mono text-xs text-[#5b6870]"> {row.driver.employeeCode}</span>}
      </span>
    ) : <span className="whitespace-nowrap text-[#5b6870]">Sem motorista</span>,
  },
  {
    chave: 'status',
    titulo: 'Situação',
    valorOrdenacao: row => row.operationalStatus,
    dica: row => row.operationalStatus,
    render: row => <span className="block md:max-w-[8.5rem] md:whitespace-nowrap 2xl:max-w-none"><FleetStatusBadge status={row.operationalStatus} compact /></span>,
  },
  {
    chave: 'departure',
    titulo: 'Saída',
    valorOrdenacao: row => row.departureTime || '',
    dica: row => [row.departureTime, row.stoppedMinutes ? `parado ${row.stoppedDurationLabel}` : ''].filter(Boolean).join(' · '),
    render: row => (
      <span className="whitespace-nowrap">
        <span className="font-mono font-semibold text-slate-800">{row.departureTime || '—'}</span>
        {row.stoppedMinutes ? <span className="text-xs text-[#5b6870]"> · parado {row.stoppedDurationLabel}</span> : null}
      </span>
    ),
  },
  {
    chave: 'location',
    titulo: 'Local',
    valorOrdenacao: row => row.location || '',
    dica: row => row.location || 'Local não informado',
    render: row => row.location
      ? <span className={`${UMA_LINHA} md:max-w-[8rem] 2xl:max-w-[14rem]`}>{row.location}</span>
      : <span className="whitespace-nowrap text-[#5b6870]">—</span>,
  },
  {
    chave: 'note',
    titulo: 'Observação',
    dica: observacaoDe,
    render: row => <span className={`${UMA_LINHA} md:max-w-[9rem] 2xl:max-w-[28rem]`}>{observacaoDe(row) || '—'}</span>,
  },
  {
    chave: 'approval',
    titulo: 'Aprovação',
    valorOrdenacao: row => row.approvalStatus,
    dica: rotuloAprovacao,
    render: row => aprovar && row.approvalStatus === 'PENDENTE' ? (
      <span className="inline-flex flex-wrap gap-1.5 md:flex-nowrap md:whitespace-nowrap">
        <button type="button" onClick={() => aprovar(row, 'APROVADO')} aria-label={`Aprovar ${row.equipment.prefix}`} title="Aprovar" className={`${ICONE} border-emerald-200 text-[#176b4d] hover:bg-emerald-50`}><Check className="size-4" aria-hidden="true" /><span className="md:hidden">Aprovar</span></button>
        <button type="button" onClick={() => aprovar(row, 'REJEITADO')} aria-label={`Rejeitar ${row.equipment.prefix}`} title="Rejeitar" className={`${ICONE} border-rose-200 text-rose-700 hover:bg-rose-50`}><X className="size-4" aria-hidden="true" /><span className="md:hidden">Rejeitar</span></button>
      </span>
    ) : seloAprovacao(row),
  },
];

/**
 * Lançamentos da Situação do dia na tabela padrão do sistema: ordenar no
 * cabeçalho, caixa de marcar na 1ª coluna, ações na última, rodapé com total
 * e páginas, e cartões com os mesmos campos no celular. Tocar na linha abre
 * os detalhes.
 */
export default function FleetDataTable({
  rows,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDetails,
  onDelete,
  canApprove = false,
  onApprove,
}: Props) {
  const escopo = useEntradaDeLista<HTMLDivElement>([rows.length]);
  const colunasDaTabela = useMemo(() => colunas(canApprove ? onApprove : undefined), [canApprove, onApprove]);
  const marcados = useMemo(() => new Set(selectedIds), [selectedIds]);
  const alternar = (id: string) => onSelectionChange(marcados.has(id)
    ? selectedIds.filter(atual => atual !== id)
    : [...selectedIds, id]);
  const alternarVarios = (ids: string[], marcar: boolean) => onSelectionChange(marcar
    ? [...new Set([...selectedIds, ...ids])]
    : selectedIds.filter(id => !ids.includes(id)));

  const acoes = (row: FleetCurrentState) => {
    const prefixo = row.equipment.prefix;
    return (
      <>
        <button type="button" onClick={() => onEdit(row)} aria-label={`Editar ${prefixo}`} title="Editar" className={`${ICONE} border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-[#176b4d]`}><Pencil className="size-4" aria-hidden="true" /><span className="md:hidden">Editar</span></button>
        {onDelete && <button type="button" onClick={() => onDelete(row)} aria-label={`Excluir ${prefixo}`} title="Excluir" className={`${ICONE} border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700`}><Trash2 className="size-4" aria-hidden="true" /><span className="md:hidden">Excluir</span></button>}
      </>
    );
  };

  return (
    // No computador ocupa o resto da TelaCheia: o cabeçalho da tabela fica
    // preso, só as linhas rolam e o rodapé com as páginas fica à vista.
    <div ref={escopo} className="flex min-h-[16rem] flex-1 flex-col" data-fleet-enter>
      <TabelaPadrao
        titulo="Lançamentos do dia"
        testId="frota-tabela"
        linhas={rows}
        colunas={colunasDaTabela}
        idDaLinha={row => row.recordId}
        nomeDoItem={{ um: 'lançamento', varios: 'lançamentos' }}
        ordenacaoInicial={{ chave: 'prefix', direcao: 'asc' }}
        onAbrirLinha={onDetails}
        acoes={acoes}
        selecao={{
          marcados,
          onAlternar: alternar,
          onAlternarVarios: alternarVarios,
          rotulo: row => `Selecionar ${row.equipment.prefix}`,
        }}
        vazio={(
          <div className="grid place-items-center gap-1 px-6 py-12 text-center">
            <p className="text-base font-bold text-slate-800">Nenhum lançamento com esses filtros</p>
            <p className="text-sm text-[#5b6870]">Troque o dia, limpe os filtros ou faça um novo lançamento.</p>
          </div>
        )}
      />
    </div>
  );
}

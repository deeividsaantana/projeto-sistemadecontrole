import { useMemo, useState } from 'react';
import { ChevronDown, CopyPlus, Eye, FilterX, Pencil, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { cn } from '../../shared/ui/styles';
import { isDuplicateTicket } from '../../utils/ticketDuplicateDetection';
import { normalizeTicketNumber } from '../../utils/ticketNumberSequence';
import type { TicketJazida, TipoTicketJazida } from '../../types';
import { BOTAO_PERIGO, BOTAO_SECUNDARIO, CAMPO, FOCO, ROTULO } from '../cadastros/estilos';
import { EMPRESAS_TICKET, dataBr, tipoDoTicket } from './constantes';
import { contarFiltros, periodoDosUltimos, type FiltrosTickets } from './filtrosTickets';

interface ListaDeTicketsProps {
  tickets: readonly TicketJazida[];
  filtrados: readonly TicketJazida[];
  via: TipoTicketJazida;
  onTrocarVia: (via: TipoTicketJazida) => void;
  filtros: FiltrosTickets;
  onFiltros: (mudanca: Partial<FiltrosTickets>) => void;
  onLimparFiltros: () => void;
  duplicateKeys: ReadonlySet<string>;
  materialOptions: readonly string[];
  destinationOptions: readonly string[];
  marcados: ReadonlySet<string>;
  onMarcados: (proximos: Set<string>) => void;
  onVer: (ticket: TicketJazida) => void;
  onGerarRecebimento: (ticket: TicketJazida) => void;
  onEditar: (ticket: TicketJazida) => void;
  /** Sem eles a lista não mostra Excluir nem Inativar: só o administrador exclui. */
  onExcluir?: (ticket: TicketJazida) => void;
  onInativarMarcados?: () => void;
}

const SITUACAO: Record<string, { rotulo: string; tom: string }> = {
  Enviado: { rotulo: 'Concluído', tom: 'bg-emerald-50 text-emerald-900 ring-emerald-200' },
  OK: { rotulo: 'Concluído', tom: 'bg-emerald-50 text-emerald-900 ring-emerald-200' },
  Rascunho: { rotulo: 'Rascunho', tom: 'bg-amber-50 text-amber-900 ring-amber-200' },
  Pendente: { rotulo: 'Pendente', tom: 'bg-amber-50 text-amber-900 ring-amber-200' },
  Duplicado: { rotulo: 'Número repetido', tom: 'bg-rose-50 text-rose-800 ring-rose-200' },
  'Erro de importação': { rotulo: 'Faltou dado na planilha', tom: 'bg-rose-50 text-rose-800 ring-rose-200' },
  'Verificar quantidade': { rotulo: 'Conferir quantidade', tom: 'bg-amber-50 text-amber-900 ring-amber-200' },
  'Verificar bomba': { rotulo: 'Conferir bomba', tom: 'bg-amber-50 text-amber-900 ring-amber-200' },
};

const BOTAO_ICONE = `grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`;
const PERIODOS = [{ rotulo: 'Hoje', dias: 1 }, { rotulo: '7 dias', dias: 7 }, { rotulo: '30 dias', dias: 30 }] as const;

/** Lista de tickets de uma via, com busca, filtros, seleção e as ações de cada ticket. */
export default function ListaDeTickets({
  tickets, filtrados, via, onTrocarVia, filtros, onFiltros, onLimparFiltros, duplicateKeys,
  materialOptions, destinationOptions, marcados, onMarcados,
  onVer, onGerarRecebimento, onEditar, onExcluir, onInativarMarcados,
}: ListaDeTicketsProps) {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const ativos = contarFiltros(filtros);

  const situacaoDe = (t: TicketJazida) => (isDuplicateTicket(t, duplicateKeys) ? 'Duplicado' : t.statusFluxo || t.status || 'Enviado');
  const recebimentosGerados = useMemo(() => new Set(tickets
    .filter(item => tipoDoTicket(item) === 'Recebimento')
    .map(item => item.ticketNumero.trim().toLowerCase())), [tickets]);
  const totalDaVia = useMemo(() => tickets.filter(item => tipoDoTicket(item) === via).length, [tickets, via]);

  const resumo = useMemo(() => {
    const m3 = filtrados.filter(t => (t.unidadeQuantidade || 'm³') === 'm³').reduce((soma, t) => soma + (Number(t.quantidadeM3) || 0), 0);
    const cacambas = filtrados.filter(t => t.unidadeQuantidade === 'caçamba').reduce((soma, t) => soma + (Number(t.quantidadeM3) || 0), 0);
    const repetidos = filtrados.filter(t => isDuplicateTicket(t, duplicateKeys)).length;
    const ok = filtrados.filter(t => !isDuplicateTicket(t, duplicateKeys) && (t.status || 'OK') === 'OK').length;
    const pendentes = filtrados.filter(t => !isDuplicateTicket(t, duplicateKeys) && (t.status || 'OK') === 'Pendente').length;
    return { m3, cacambas, repetidos, ok, pendentes };
  }, [filtrados, duplicateKeys]);

  const periodoAtivo = (dias?: number) => {
    const alvo = periodoDosUltimos(dias);
    return filtros.dataInicial === alvo.dataInicial && filtros.dataFinal === alvo.dataFinal;
  };

  const colunas: ColunaTabela<TicketJazida>[] = [
    { chave: 'ticket', titulo: 'Ticket', render: t => <b className="tabular-nums text-slate-900">{t.ticketNumero || '—'}</b>, valorOrdenacao: t => Number(normalizeTicketNumber(t.ticketNumero)) || t.ticketNumero, larguraMinima: 90 },
    {
      chave: 'data', titulo: 'Data',
      render: t => `${dataBr(t.data)} ${tipoDoTicket(t) === 'Recebimento' ? (t.horaChegada || t.horaSaida || '') : (t.horaSaida || '')}`.trim(),
      valorOrdenacao: t => `${t.data} ${t.horaChegada || t.horaSaida || ''}`,
    },
    {
      chave: 'caminhao', titulo: 'Caminhão',
      render: t => [t.prefixo, t.placa].filter(Boolean).join(' · ') || '—',
      dica: t => [t.prefixo, t.placa, t.equipamentoNome || t.familiaEquipamento].filter(Boolean).join(' · '),
      valorOrdenacao: t => t.prefixo,
    },
    { chave: 'material', titulo: 'Material', render: t => (t.tipoMaterial === 'Outros' ? t.materialOutro || 'Outros' : t.tipoMaterial) || '—', valorOrdenacao: t => t.tipoMaterial },
    { chave: 'quantidade', titulo: 'Qtd.', alinhamento: 'direita', render: t => `${Number(t.quantidadeM3 || 0).toLocaleString('pt-BR')} ${t.unidadeQuantidade || 'm³'}`, valorOrdenacao: t => Number(t.quantidadeM3) || 0 },
    {
      chave: 'destino', titulo: via === 'Recebimento' ? 'Ramo de descarga' : 'Destino',
      render: t => [(t.destinoObra === 'Outros' ? t.destinoOutro || 'Outros' : t.destinoObra), t.estaca].filter(Boolean).join(' · ') || '—',
      valorOrdenacao: t => t.destinoObra,
    },
    { chave: 'empresa', titulo: 'Empresa', render: t => [t.empresa, t.notaFiscalNumero && `NF ${t.notaFiscalNumero}`].filter(Boolean).join(' · ') || '—', valorOrdenacao: t => t.empresa },
    {
      chave: 'situacao', titulo: 'Situação',
      render: t => {
        const info = SITUACAO[situacaoDe(t)] ?? SITUACAO.OK;
        return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-sm font-semibold ring-1 ring-inset', info.tom)}>{info.rotulo}</span>;
      },
      dica: t => (SITUACAO[situacaoDe(t)] ?? SITUACAO.OK).rotulo,
      valorOrdenacao: t => situacaoDe(t),
    },
  ];

  const acoes = (t: TicketJazida) => {
    const rascunho = (t.statusFluxo || 'Enviado') === 'Rascunho';
    const temRecebimento = recebimentosGerados.has(t.ticketNumero.trim().toLowerCase());
    return (
      <>
        <button type="button" onClick={() => onEditar(t)} className={cn(BOTAO_SECUNDARIO, 'min-h-9 px-3')}><Pencil className="size-4" aria-hidden="true" />{rascunho ? 'Continuar' : 'Corrigir'}</button>
        <button type="button" onClick={() => onVer(t)} className={BOTAO_ICONE} aria-label={`Ver e imprimir a folha do ticket ${t.ticketNumero}`} title="Ver e imprimir a folha"><Eye className="size-4" aria-hidden="true" /></button>
        {tipoDoTicket(t) === 'Liberação' && (
          <button type="button" onClick={() => onGerarRecebimento(t)} className={cn(BOTAO_ICONE, temRecebimento && 'text-slate-400')}
            aria-label={temRecebimento ? `Recebimento do ticket ${t.ticketNumero} já existe` : `Criar o recebimento do ticket ${t.ticketNumero} com o mesmo caminhão`}
            title={temRecebimento ? 'O recebimento já existe' : 'Criar o recebimento com o mesmo caminhão'}>
            <CopyPlus className="size-4" aria-hidden="true" />
          </button>
        )}
        {onExcluir && (
          <button type="button" onClick={() => onExcluir(t)} className={cn(BOTAO_ICONE, 'hover:border-rose-400 hover:text-rose-700')} aria-label={`Excluir o ticket ${t.ticketNumero}`} title="Excluir">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div data-jazida-bloco className="shrink-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Qual via" className="inline-flex rounded-xl border border-slate-200 bg-[#f7f8f6] p-1">
            {(['Liberação', 'Recebimento'] as TipoTicketJazida[]).map(tipo => (
              <button key={tipo} type="button" aria-pressed={via === tipo} onClick={() => onTrocarVia(tipo)} data-testid={`jazida-via-${tipo === 'Liberação' ? 'liberacao' : 'recebimento'}`}
                className={cn('min-h-10 rounded-lg px-3 text-sm font-bold transition-colors', via === tipo ? 'bg-[#176b4d] text-white' : 'text-slate-700 hover:text-slate-900', FOCO)}>
                {tipo === 'Liberação' ? 'Liberação (saída)' : 'Recebimento (chegada)'}
              </button>
            ))}
          </div>
          <label className="relative min-w-0 flex-1 basis-60">
            <span className="sr-only">Buscar ticket</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={filtros.busca} onChange={e => onFiltros({ busca: e.target.value })} placeholder="Ticket, placa, prefixo, material, destino ou nota" className={`${CAMPO} pl-10`} data-testid="jazida-busca" />
          </label>
          <label className="flex items-center gap-2">
            <span className={ROTULO}>Situação</span>
            <select value={filtros.situacao} onChange={e => onFiltros({ situacao: e.target.value })} className={`${CAMPO} w-auto`}>
              <option value="">Todas</option>
              <option value="Enviado">Concluídos</option>
              <option value="Rascunho">Rascunhos</option>
              <option value="Pendente">Pendentes</option>
              <option value="Duplicado">Número repetido</option>
              <option value="OK">Conferidos</option>
            </select>
          </label>
          <button type="button" onClick={() => setFiltrosAbertos(v => !v)} aria-expanded={filtrosAbertos} aria-controls="jazida-mais-filtros" className={BOTAO_SECUNDARIO}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Mais filtros
            {ativos > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-[#176b4d] px-1.5 text-xs font-bold text-white">{ativos}</span>}
            <ChevronDown className={cn('size-4 transition-transform', filtrosAbertos && 'rotate-180')} aria-hidden="true" />
          </button>
          {ativos > 0 && <button type="button" onClick={onLimparFiltros} className={BOTAO_SECUNDARIO}><FilterX className="size-4" aria-hidden="true" /> Limpar filtros</button>}
        </div>

        {filtrosAbertos && (
          <div id="jazida-mais-filtros" className="space-y-3 border-t border-slate-100 pt-3">
            <div role="group" aria-label="Período" className="flex flex-wrap items-center gap-2">
              <span className={ROTULO}>Período</span>
              {PERIODOS.map(periodo => (
                <button key={periodo.dias} type="button" aria-pressed={periodoAtivo(periodo.dias)} onClick={() => onFiltros(periodoDosUltimos(periodo.dias))}
                  className={cn('min-h-10 rounded-full border px-4 text-sm font-semibold', periodoAtivo(periodo.dias) ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500', FOCO)}>
                  {periodo.rotulo}
                </button>
              ))}
              <button type="button" aria-pressed={!filtros.dataInicial && !filtros.dataFinal} onClick={() => onFiltros(periodoDosUltimos())}
                className={cn('min-h-10 rounded-full border px-4 text-sm font-semibold', !filtros.dataInicial && !filtros.dataFinal ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500', FOCO)}>
                Tudo
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <label className="block space-y-1"><span className={ROTULO}>De</span><input type="date" value={filtros.dataInicial} onChange={e => onFiltros({ dataInicial: e.target.value })} className={CAMPO} /></label>
              <label className="block space-y-1"><span className={ROTULO}>Até</span><input type="date" value={filtros.dataFinal} onChange={e => onFiltros({ dataFinal: e.target.value })} className={CAMPO} /></label>
              <label className="block space-y-1"><span className={ROTULO}>Número do ticket</span><input type="text" inputMode="numeric" value={filtros.ticketNumero} onChange={e => onFiltros({ ticketNumero: e.target.value })} className={CAMPO} /></label>
              <label className="block space-y-1"><span className={ROTULO}>Prefixo</span><input type="text" value={filtros.prefixo} onChange={e => onFiltros({ prefixo: e.target.value })} className={CAMPO} /></label>
              <label className="block space-y-1"><span className={ROTULO}>Placa</span><input type="text" value={filtros.placa} onChange={e => onFiltros({ placa: e.target.value })} className={CAMPO} /></label>
              <label className="block space-y-1"><span className={ROTULO}>Material</span>
                <select value={filtros.tipoMaterial} onChange={e => onFiltros({ tipoMaterial: e.target.value })} className={CAMPO}>
                  <option value="">Todos</option>
                  {materialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block space-y-1"><span className={ROTULO}>Destino</span>
                <select value={filtros.destinoObra} onChange={e => onFiltros({ destinoObra: e.target.value })} className={CAMPO}>
                  <option value="">Todos</option>
                  {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="block space-y-1"><span className={ROTULO}>Empresa</span>
                <select value={filtros.empresa} onChange={e => onFiltros({ empresa: e.target.value })} className={CAMPO}>
                  <option value="">Todas</option>
                  {EMPRESAS_TICKET.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
          <p aria-live="polite">
            <b className="tabular-nums text-slate-900">{filtrados.length}</b> de {totalDaVia} tickets de {via.toLowerCase()}
            {' · '}<span className="tabular-nums">{resumo.m3.toLocaleString('pt-BR')} m³</span>
            {resumo.cacambas > 0 && <> · <span className="tabular-nums">{resumo.cacambas.toLocaleString('pt-BR')} caçambas</span></>}
            {' · '}{resumo.ok} concluídos · {resumo.pendentes} pendentes
            {resumo.repetidos > 0 && <> · <b className="text-rose-700">{resumo.repetidos} com número repetido</b></>}
          </p>
          {onInativarMarcados && marcados.size > 0 && (
            <button type="button" onClick={onInativarMarcados} className={cn(BOTAO_PERIGO, 'min-h-10')} data-testid="jazida-inativar-marcados">
              <Trash2 className="size-4" aria-hidden="true" /> Inativar {marcados.size} marcado(s)
            </button>
          )}
        </div>
      </div>

      <TabelaPadrao
        titulo={`Tickets de ${via.toLowerCase()}`}
        linhas={filtrados}
        colunas={colunas}
        idDaLinha={t => t.id}
        nomeDoItem={{ um: 'ticket', varios: 'tickets' }}
        vazio={ativos ? 'Nenhum ticket com esses filtros.' : 'Nenhum ticket lançado nesta via.'}
        acoes={acoes}
        tituloAcoes="O que fazer"
        selecao={onInativarMarcados ? {
          marcados,
          onAlternar: id => { const proximos = new Set(marcados); if (proximos.has(id)) proximos.delete(id); else proximos.add(id); onMarcados(proximos); },
          onAlternarVarios: (ids, marcar) => { const proximos = new Set(marcados); ids.forEach(id => (marcar ? proximos.add(id) : proximos.delete(id))); onMarcados(proximos); },
          rotulo: t => `Marcar o ticket ${t.ticketNumero}`,
        } : undefined}
        className="min-h-[18rem] flex-1"
        testId="jazida-lista"
      />
    </div>
  );
}

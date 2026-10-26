import { AlertTriangle, CalendarDays, Check, FileText, RotateCcw } from 'lucide-react';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { cn } from '../../shared/ui/styles';
import type { JazidaDailyControl, JazidaDailyControlRow } from '../../utils/jazidaDailyControl';
import type { TipoTicketJazida } from '../../types';
import { BOTAO_SECUNDARIO, CAMPO, FOCO } from '../cadastros/estilos';
import { formatEventDateTime } from './constantes';
import { Numeros } from './Numeros';

interface ConferenciaDoDiaProps {
  dailyControl: JazidaDailyControl;
  controlDate: string;
  onTrocarDia: (dia: string) => void;
  dailyDuplicateCount: number;
  onVerDuplicados: () => void;
  onAlternarVia: (numero: string, tipo: TipoTicketJazida) => void;
  onMarcarTodas: (tipo: TipoTicketJazida) => void;
  onDesmarcarTodas: () => void;
  onAbrirNota: (numero: string) => void;
}

/** "21/10 08:30": o dia e a hora em que a via voltou, sem os segundos. */
const horaCurta = (valor: string) => {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const BotaoVia = ({ voltou, quando, nome, onClick }: { voltou: boolean; quando: string; nome: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={voltou}
    aria-label={voltou ? `${nome}: voltou ${horaCurta(quando)}. Tocar para desmarcar` : `${nome}: marcar que voltou`}
    title={voltou ? `Voltou em ${formatEventDateTime(quando)}` : undefined}
    className={cn(
      'inline-flex min-h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-semibold transition-colors',
      voltou ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500',
      FOCO,
    )}
  >
    <span className={cn('grid size-5 shrink-0 place-items-center rounded border', voltou ? 'border-emerald-600 bg-[#176b4d] text-white' : 'border-amber-500 bg-white')} aria-hidden="true">
      {voltou && <Check className="size-3.5" strokeWidth={3} />}
    </span>
    {voltou ? `Voltou ${horaCurta(quando)}` : 'Marcar que voltou'}
  </button>
);

/**
 * Conferência do dia: cada número impresso tem duas vias de papel, a da
 * saída da jazida (liberação) e a da chegada na obra (recebimento). A pessoa
 * marca cada via quando o papel volta; a hora fica gravada sozinha.
 */
export default function ConferenciaDoDia({
  dailyControl,
  controlDate,
  onTrocarDia,
  dailyDuplicateCount,
  onVerDuplicados,
  onAlternarVia,
  onMarcarTodas,
  onDesmarcarTodas,
  onAbrirNota,
}: ConferenciaDoDiaProps) {
  const totalVias = dailyControl.totalCriados * 2;
  const voltaram = dailyControl.liberacoesRecebidas + dailyControl.recebimentosRecebidos;
  const semLinhas = !dailyControl.rows.length;

  const colunas: ColunaTabela<JazidaDailyControlRow>[] = [
    { chave: 'numero', titulo: 'Ticket', render: row => <b className="tabular-nums text-slate-900">{row.numero}</b>, valorOrdenacao: row => Number(row.numero) || row.numero, larguraMinima: 90 },
    {
      chave: 'liberacao', titulo: 'Liberação (saída)', larguraMinima: 190,
      render: row => <BotaoVia voltou={row.liberacaoRecebida} quando={row.liberacaoRecebidaEm} nome={`Liberação do ticket ${row.numero}`} onClick={() => onAlternarVia(row.numero, 'Liberação')} />,
      valorOrdenacao: row => (row.liberacaoRecebida ? 1 : 0),
    },
    {
      chave: 'recebimento', titulo: 'Recebimento (chegada)', larguraMinima: 190,
      render: row => <BotaoVia voltou={row.recebimentoRecebido} quando={row.recebimentoRecebidoEm} nome={`Recebimento do ticket ${row.numero}`} onClick={() => onAlternarVia(row.numero, 'Recebimento')} />,
      valorOrdenacao: row => (row.recebimentoRecebido ? 1 : 0),
    },
    {
      chave: 'caminhao', titulo: 'Caminhão',
      render: row => {
        const ticket = row.liberacao || row.recebimento;
        return ticket?.prefixo ? `${ticket.prefixo}${ticket.placa ? ` · ${ticket.placa}` : ''}` : ticket?.placa || 'Ainda sem caminhão';
      },
      valorOrdenacao: row => (row.liberacao || row.recebimento)?.prefixo,
    },
    {
      chave: 'impresso', titulo: 'Impresso em',
      render: row => `${formatEventDateTime(row.criadoEm)}${row.loteId.startsWith('avulso-') ? ' · lançado avulso' : ''}`,
      valorOrdenacao: row => row.criadoEm,
    },
    {
      chave: 'nota', titulo: 'Nota fiscal',
      render: row => {
        const note = row.recebimento?.notaFiscalNumero || row.liberacao?.notaFiscalNumero;
        return (
          <button type="button" onClick={() => onAbrirNota(row.numero)} aria-label={note ? `Nota ${note} do ticket ${row.numero}: corrigir` : `Lançar nota do ticket ${row.numero}`}
            className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold hover:bg-emerald-50', note ? 'text-slate-900' : 'text-[#176b4d]', FOCO)}>
            <FileText className="size-4 shrink-0" aria-hidden="true" />{note || 'Lançar nota'}
          </button>
        );
      },
    },
  ];

  return (
    <>
      <div data-jazida-bloco className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-700">Dia da conferência</span>
          <span className="relative flex items-center">
            <CalendarDays className="pointer-events-none absolute left-3 size-4 text-slate-500" aria-hidden="true" />
            <input type="date" value={controlDate} onChange={event => event.target.value && onTrocarDia(event.target.value)} className={`${CAMPO} w-auto pl-9 font-semibold`} data-testid="jazida-dia" />
          </span>
        </label>
        <p className="min-w-0 flex-1 basis-72 text-sm text-slate-600">
          Cada número impresso tem <b className="text-slate-800">duas vias de papel</b>: a da saída da jazida (liberação) e a da chegada na obra (recebimento). Marque cada uma quando o papel voltar. A hora fica gravada sozinha.
        </p>
      </div>

      <Numeros rotulo="Resumo do dia" itens={[
        { rotulo: 'Números do dia', valor: dailyControl.totalCriados, detalhe: 'impressos ou lançados' },
        { rotulo: 'Vias que voltaram', valor: voltaram, detalhe: `de ${totalVias} vias`, tom: 'ok' },
        { rotulo: 'Liberações', valor: dailyControl.liberacoesRecebidas, detalhe: `${dailyControl.pendentesLiberacao.length} faltando`, tom: dailyControl.pendentesLiberacao.length ? 'alerta' : 'ok' },
        { rotulo: 'Recebimentos', valor: dailyControl.recebimentosRecebidos, detalhe: `${dailyControl.pendentesRecebimento.length} faltando`, tom: dailyControl.pendentesRecebimento.length ? 'alerta' : 'ok' },
        { rotulo: 'Viagens completas', valor: dailyControl.paresCompletos, detalhe: 'as duas vias voltaram', tom: 'ok' },
        { rotulo: 'Ainda faltando', valor: dailyControl.pendentesQualquerVia, detalhe: `${dailyControl.percentualConferencia}% do dia conferido`, tom: dailyControl.pendentesQualquerVia ? 'alerta' : 'ok' },
      ]} />

      <div data-jazida-bloco className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-sm"><span id="jazida-fechamento" className="font-semibold text-slate-700">Fechamento do dia</span><b className="tabular-nums text-[#176b4d]">{dailyControl.percentualConferencia}%</b></div>
        <div role="progressbar" aria-labelledby="jazida-fechamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dailyControl.percentualConferencia} className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-500" style={{ width: `${dailyControl.percentualConferencia}%` }} />
        </div>
      </div>

      {dailyDuplicateCount > 0 && (
        <button type="button" onClick={onVerDuplicados} data-jazida-bloco className={`flex min-h-11 w-full items-center gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-2 text-left hover:border-rose-400 ${FOCO}`}>
          <AlertTriangle className="size-5 shrink-0 text-rose-700" aria-hidden="true" />
          <span>
            <b className="block text-sm text-rose-800">{dailyDuplicateCount} via(s) com número repetido neste dia</b>
            <span className="text-sm text-rose-800">Nada foi apagado. Toque para ver esses tickets e corrigir.</span>
          </span>
        </button>
      )}

      <div data-jazida-bloco className="grid gap-2 lg:grid-cols-2">
        {([
          ['Liberação', 'Faltam liberações (saída da jazida)', dailyControl.pendentesLiberacao, 'Todas as liberações voltaram.'],
          ['Recebimento', 'Faltam recebimentos (chegada na obra)', dailyControl.pendentesRecebimento, 'Todos os recebimentos voltaram.'],
        ] as const).map(([tipo, titulo, numeros, tudoCerto]) => (
          <section key={tipo} aria-label={titulo} className={cn('rounded-2xl border px-4 py-3', numeros.length ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/60')}>
            <h2 className="flex items-center justify-between gap-3 text-sm font-bold text-slate-900">{titulo}<span className="rounded-full bg-white px-2 py-0.5 tabular-nums text-amber-900 ring-1 ring-inset ring-amber-200">{numeros.length}</span></h2>
            <p className="mt-1.5 line-clamp-2 text-sm tabular-nums text-slate-800" title={numeros.join(', ')}>
              {numeros.length ? numeros.join(', ') : <span className="font-semibold text-[#176b4d]">{tudoCerto}</span>}
            </p>
          </section>
        ))}
      </div>

      <div data-jazida-bloco className="flex min-h-[22rem] flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="jazida-checklist-titulo" className="text-base font-bold text-slate-900">Vias do dia, número por número</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={semLinhas} onClick={() => onMarcarTodas('Liberação')} className={BOTAO_SECUNDARIO}><Check className="size-4" aria-hidden="true" /> Todas as liberações voltaram</button>
            <button type="button" disabled={semLinhas} onClick={() => onMarcarTodas('Recebimento')} className={BOTAO_SECUNDARIO}><Check className="size-4" aria-hidden="true" /> Todos os recebimentos voltaram</button>
            <button type="button" disabled={semLinhas} onClick={onDesmarcarTodas} className={BOTAO_SECUNDARIO}><RotateCcw className="size-4" aria-hidden="true" /> Desmarcar tudo</button>
          </div>
        </div>
        <TabelaPadrao
          titulo={`Vias do dia ${controlDate.split('-').reverse().join('/')}`}
          linhas={dailyControl.rows}
          colunas={colunas}
          idDaLinha={row => row.numero}
          nomeDoItem={{ um: 'número', varios: 'números' }}
          vazio="Nenhum ticket neste dia. Use “Imprimir tickets em sequência” em Mais ações para começar."
          className="min-h-0 flex-1"
          testId="jazida-checklist"
        />
      </div>
    </>
  );
}

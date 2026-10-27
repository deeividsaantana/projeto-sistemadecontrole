/**
 * Panorama da Situação do dia, no mesmo desenho dos cartões do Painel de
 * Controle: anel com a situação da frota (cada fatia filtra a lista), barras
 * por canteiro (tocar filtra o canteiro) e a conferência do dia (quantos
 * equipamentos e operadores da relação já foram lançados). Substitui a faixa
 * de sete números soltos.
 */
import { useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, ClipboardCheck, MapPin, Users } from 'lucide-react';
import type { FleetMetrics, FleetOperationalStatus } from '../../fleet/domain';
import { FLEET_OPERATIONAL_STATUS } from '../../fleet/domain';
import { CountUp } from '../../shared/ui';
import { CARTAO, FOCO } from '../cadastros/estilos';

export interface CanteiroDoDia {
  nome: string;
  total: number;
  operando: number;
  manutencao: number;
}

interface Conferido {
  total: number;
  informados: number;
}

interface Props {
  metrics: FleetMetrics;
  status: FleetOperationalStatus | 'Todos';
  onStatus: (status: FleetOperationalStatus | 'Todos') => void;
  canteiros: readonly CanteiroDoDia[];
  canteiro: string;
  onCanteiro: (canteiro: string) => void;
  equipamentos: Conferido;
  operadores: Conferido;
  onAbrirEquipamentos: () => void;
  onAbrirOperadores: () => void;
}

interface Fatia {
  rotulo: string;
  valor: number;
  status: FleetOperationalStatus;
  /** Cor da fatia no anel e do ponto na legenda (Tailwind, sem hex solto). */
  traco: string;
  ponto: string;
}

const ROTULO_CARTAO = 'text-xs font-bold uppercase tracking-[0.14em] text-[#176b4d]';
const TITULO_CARTAO = 'text-base font-bold text-slate-950';

const CHAVE_RESUMO = 'renea_frota_resumo_recolhido';
const lerRecolhido = () => {
  try {
    return window.localStorage.getItem(CHAVE_RESUMO) === '1';
  } catch {
    return false;
  }
};

const porcento = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);

function Anel({ fatias, total }: { fatias: Fatia[]; total: number }) {
  let inicio = 0;
  return (
    <div className="relative size-[6.5rem] shrink-0" role="img" aria-label={`Frota do dia: ${fatias.map(fatia => `${fatia.valor} ${fatia.rotulo.toLowerCase()}`).join(', ')}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="48" pathLength={100} className="fill-none stroke-slate-100" strokeWidth={14} />
        {total > 0 && fatias.filter(fatia => fatia.valor > 0).map(fatia => {
          const parte = (fatia.valor / total) * 100;
          const circulo = (
            <circle key={fatia.status} cx="60" cy="60" r="48" pathLength={100} className={`fill-none ${fatia.traco}`} strokeWidth={14}
              strokeDasharray={`${Math.max(0, parte - 0.8)} ${100 - Math.max(0, parte - 0.8)}`} strokeDashoffset={-inicio} />
          );
          inicio += parte;
          return circulo;
        })}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        <span>
          <CountUp value={total} className="block text-2xl font-bold leading-none tabular-nums text-slate-950" />
          <span className="text-xs font-semibold text-[#5b6870]">{total === 1 ? 'lançada' : 'lançadas'}</span>
        </span>
      </span>
    </div>
  );
}

function Barra({ rotulo, valor, total, onAbrir, Icone }: { rotulo: string; valor: number; total: number; onAbrir: () => void; Icone: typeof Users }) {
  const parte = porcento(valor, total);
  const falta = Math.max(0, total - valor);
  return (
    <button type="button" onClick={onAbrir} className={`group grid w-full gap-1 rounded-xl px-2 py-1 text-left transition hover:bg-[#f7f8f6] ${FOCO}`}>
      <span className="flex items-center gap-2 text-sm">
        <Icone className="size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />
        <span className="font-bold text-slate-900">{rotulo}</span>
        <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-slate-700">{valor} de {total}</span>
      </span>
      <span className="block h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${rotulo} lançados`} aria-valuenow={parte} aria-valuemin={0} aria-valuemax={100}>
        <span className="block h-full rounded-full bg-[#176b4d] transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none" style={{ width: `${parte}%` }} />
      </span>
      <span className={`text-xs font-semibold ${falta ? 'text-[#c2410c]' : 'text-emerald-700'}`}>
        {falta ? `Faltam ${falta} · ver quem` : 'Todos lançados'}
        <ArrowUpRight className="ml-0.5 inline size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </button>
  );
}

export default function PanoramaDoDia({ metrics, status, onStatus, canteiros, canteiro, onCanteiro, equipamentos, operadores, onAbrirEquipamentos, onAbrirOperadores }: Props) {
  // Recolher deixa uma faixa de uma linha e devolve a altura para a tabela;
  // a escolha fica guardada no aparelho.
  const [recolhido, setRecolhido] = useState(lerRecolhido);
  const alternar = () => setRecolhido(atual => {
    try {
      window.localStorage.setItem(CHAVE_RESUMO, atual ? '0' : '1');
    } catch {
      // Sem memória do aparelho a escolha vale só nesta visita.
    }
    return !atual;
  });
  const fatias: Fatia[] = [
    { rotulo: 'Em operação', valor: metrics.operating, status: FLEET_OPERATIONAL_STATUS.operating, traco: 'stroke-emerald-600', ponto: 'bg-emerald-600' },
    { rotulo: 'Manutenção', valor: metrics.maintenance + metrics.waitingMaintenance, status: FLEET_OPERATIONAL_STATUS.maintenance, traco: 'stroke-rose-500', ponto: 'bg-rose-500' },
    { rotulo: 'À disposição', valor: metrics.available, status: FLEET_OPERATIONAL_STATUS.available, traco: 'stroke-sky-500', ponto: 'bg-sky-500' },
    { rotulo: 'A confirmar', valor: metrics.pending, status: FLEET_OPERATIONAL_STATUS.pending, traco: 'stroke-amber-400', ponto: 'bg-amber-400' },
  ];
  const maiorCanteiro = Math.max(1, ...canteiros.map(item => item.total));
  const disponibilidade = metrics.availabilityRate === null ? '—' : `${Math.round(metrics.availabilityRate)}%`;
  const botaoFatia = (fatia: Fatia, compacto: boolean) => {
    const ativo = status === fatia.status;
    return (
      <button type="button" aria-pressed={ativo} onClick={() => onStatus(ativo ? 'Todos' : fatia.status)} data-testid={`frota-fatia-${fatia.status}`}
        className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition ${compacto ? 'w-auto whitespace-nowrap' : ''} ${ativo ? 'bg-white font-bold text-slate-950 ring-2 ring-[#176b4d]/40' : 'text-slate-700 hover:bg-white/80'} ${FOCO}`}>
        <span className={`size-2.5 shrink-0 rounded-full ${fatia.ponto}`} aria-hidden="true" />
        <span className={`min-w-0 font-semibold ${compacto ? '' : 'flex-1 truncate'}`}>{fatia.rotulo}</span>
        <span className="font-bold tabular-nums text-slate-950">{fatia.valor}</span>
      </button>
    );
  };
  const botaoRecolher = (
    <button type="button" onClick={alternar} aria-expanded={!recolhido} aria-controls="frota-panorama" data-testid="frota-recolher-resumo" title={recolhido ? 'Abrir resumo' : 'Recolher resumo'}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#5b6870] hover:bg-[#f7f8f6] hover:text-[#176b4d] ${FOCO}`}>
      {recolhido ? <><span className="sr-only">Abrir resumo</span><ChevronDown className="size-5" aria-hidden="true" /></> : <>Recolher <ChevronUp className="size-4" aria-hidden="true" /></>}
    </button>
  );

  if (recolhido) {
    return (
      <section id="frota-panorama" aria-label="Panorama da frota no dia" data-fleet-enter className={`${CARTAO} flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 bg-gradient-to-r from-white to-emerald-50/50 px-2 py-1`}>
        <span className="px-2 text-sm font-bold text-slate-950"><span className="tabular-nums">{metrics.total}</span> lançadas</span>
        {fatias.map(fatia => <span key={fatia.status}>{botaoFatia(fatia, true)}</span>)}
        <span className="px-2 text-sm text-[#5b6870] max-2xl:hidden"><span className="font-bold text-slate-900">{disponibilidade}</span> disponível</span>
        <button type="button" onClick={onAbrirEquipamentos} className={`min-h-9 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-white ${FOCO}`}>Equipamentos <span className="font-bold tabular-nums">{equipamentos.informados}/{equipamentos.total}</span></button>
        <button type="button" onClick={onAbrirOperadores} className={`min-h-9 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-white ${FOCO}`}>Operadores <span className="font-bold tabular-nums">{operadores.informados}/{operadores.total}</span></button>
        <span className="ml-auto">{botaoRecolher}</span>
      </section>
    );
  }

  return (
    <section id="frota-panorama" aria-label="Panorama da frota no dia" className="grid shrink-0 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-3">
      <article data-fleet-enter className={`${CARTAO} flex min-w-0 flex-col gap-1 bg-gradient-to-br from-white to-emerald-50/50 p-3 md:col-span-2 xl:col-span-1`}>
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={ROTULO_CARTAO}>Frota no dia</p>
            <h2 className={TITULO_CARTAO}>Situação dos equipamentos</h2>
          </div>
          {botaoRecolher}
        </header>
        <div className="flex items-center gap-3">
          <Anel fatias={fatias} total={metrics.total} />
          <ul className="grid min-w-0 flex-1 grid-cols-1 gap-0.5 sm:grid-cols-2">
            {fatias.map(fatia => <li key={fatia.status}>{botaoFatia(fatia, false)}</li>)}
            <li className="px-2 text-xs font-semibold text-[#5b6870] sm:col-span-2">
              <span className="font-bold text-slate-900">{disponibilidade}</span> disponível fora da manutenção
              {metrics.stoppedMinutes > 0 && <> · <span className="font-bold text-slate-900">{metrics.stoppedDurationLabel}</span> paradas</>}
            </li>
          </ul>
        </div>
      </article>

      <article data-fleet-enter className={`${CARTAO} flex min-w-0 flex-col gap-1 p-3`}>
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className={ROTULO_CARTAO}>Onde estão</p>
            <h2 className={TITULO_CARTAO}>Máquinas por canteiro</h2>
          </div>
          <MapPin className="size-5 text-[#176b4d]" aria-hidden="true" />
        </header>
        {canteiros.length === 0 ? (
          <p className="my-auto rounded-xl bg-[#f7f8f6] px-3 py-3 text-center text-sm text-[#5b6870]">Nenhum lançamento do dia tem canteiro informado.</p>
        ) : (
          <ul className="grid max-h-[5.75rem] gap-0.5 overflow-y-auto pr-1" data-testid="frota-canteiros">
            {canteiros.map(item => {
              const ativo = canteiro === item.nome;
              const outros = Math.max(0, item.total - item.operando - item.manutencao);
              return (
                <li key={item.nome}>
                  <button type="button" aria-pressed={ativo} onClick={() => onCanteiro(ativo ? '' : item.nome)} data-testid={`frota-canteiro-${item.nome}`}
                    title={`${item.nome}: ${item.operando} em operação, ${item.manutencao} em manutenção, ${outros} outras`}
                    className={`grid w-full gap-1 rounded-lg px-2 py-1 text-left text-sm transition ${ativo ? 'bg-emerald-50 ring-2 ring-[#176b4d]/40' : 'hover:bg-[#f7f8f6]'} ${FOCO}`}>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{item.nome}</span>
                      <span className="font-bold tabular-nums text-slate-950">{item.total}</span>
                    </span>
                    <span className="flex h-2 overflow-hidden rounded-full bg-slate-100" style={{ width: `${Math.max(12, (item.total / maiorCanteiro) * 100)}%` }} aria-hidden="true">
                      <span className="bg-emerald-600" style={{ flexGrow: item.operando }} />
                      <span className="bg-rose-500" style={{ flexGrow: item.manutencao }} />
                      <span className="bg-slate-300" style={{ flexGrow: outros }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article data-fleet-enter className={`${CARTAO} flex min-w-0 flex-col gap-1 p-3`}>
        <header className="flex items-start justify-between gap-2">
          <div>
            <p className={ROTULO_CARTAO}>Conferência</p>
            <h2 className={TITULO_CARTAO}>Quem já foi lançado</h2>
          </div>
          <ClipboardCheck className="size-5 text-[#176b4d]" aria-hidden="true" />
        </header>
        <Barra rotulo="Equipamentos" Icone={ClipboardCheck} valor={equipamentos.informados} total={equipamentos.total} onAbrir={onAbrirEquipamentos} />
        <Barra rotulo="Operadores" Icone={Users} valor={operadores.informados} total={operadores.total} onAbrir={onAbrirOperadores} />
      </article>
    </section>
  );
}

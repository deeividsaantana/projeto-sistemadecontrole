import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTelaLarga } from '../../shared/hooks/useTelaLarga';
import { ehDomingo, somarDias, type ResumoAtividade } from '../../utils/programacao';
import { BOTAO_SECUNDARIO } from '../cadastros/estilos';
import { COR_SITUACAO, diaDaSemana, diaMes, numeroObra } from './visual';

interface Props {
  resumos: readonly ResumoAtividade[];
  inicio: string;
  dias: number;
  hoje: string;
  onTrocarInicio: (dia: string) => void;
  onAbrir: (resumo: ResumoAtividade) => void;
}

/**
 * Quadro de duas semanas, como um cronograma de parede: uma linha por
 * atividade, agrupada por frente, e a barra pintada com a cor da situação.
 * Domingo fica cinza e o dia de hoje tem a coluna marcada.
 */
export function QuadroProgramacao({ resumos, inicio, dias, hoje, onTrocarInicio, onAbrir }: Props) {
  const larga = useTelaLarga();
  const colunas = Array.from({ length: dias }, (_, indice) => somarDias(inicio, indice));
  const fim = colunas[colunas.length - 1];
  const visiveis = resumos.filter(resumo => resumo.item.dataFim >= inicio && resumo.item.dataInicio <= fim);
  const frentes = new Map<string, ResumoAtividade[]>();
  for (const resumo of visiveis) {
    const frente = resumo.item.frente || 'Sem frente';
    frentes.set(frente, [...(frentes.get(frente) ?? []), resumo]);
  }
  const grade = { gridTemplateColumns: `${larga ? 'minmax(11rem, 15rem)' : '7.5rem'} repeat(${dias}, minmax(2.75rem, 1fr))` };
  const posicao = (dia: string) => Math.max(0, Math.min(dias - 1, colunas.indexOf(dia) === -1 ? (dia < inicio ? 0 : dias - 1) : colunas.indexOf(dia)));

  return (
    <section aria-label="Quadro da programação" className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <p className="text-sm font-bold text-slate-900">
          {diaMes(inicio)} a {diaMes(fim)}
          <span className="ml-2 font-semibold text-[#5b6870]">{visiveis.length} {visiveis.length === 1 ? 'atividade' : 'atividades'}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onTrocarInicio(somarDias(inicio, -7))} className={`${BOTAO_SECUNDARIO} !min-h-10 !px-2.5`} aria-label="Semana anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onTrocarInicio('')} className={`${BOTAO_SECUNDARIO} !min-h-10`}>Esta semana</button>
          <button type="button" onClick={() => onTrocarInicio(somarDias(inicio, 7))} className={`${BOTAO_SECUNDARIO} !min-h-10 !px-2.5`} aria-label="Próxima semana">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="m-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-[#5b6870]">
          Nenhuma atividade nestas duas semanas com os filtros escolhidos.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="Quadro: role para ver mais dias e atividades">
          <div className={larga ? 'min-w-[44rem]' : 'min-w-[46rem]'} role="table" aria-label={`Atividades de ${diaMes(inicio)} a ${diaMes(fim)}`}>
            <div role="row" className="sticky top-0 z-20 grid border-b border-slate-200 bg-[#f7f8f6]" style={grade}>
              <span role="columnheader" className="sticky left-0 z-10 bg-[#f7f8f6] px-3 py-2 text-xs font-bold uppercase text-[#5b6870]">Atividade</span>
              {colunas.map(dia => (
                <span
                  role="columnheader"
                  key={dia}
                  className={`border-l border-slate-200 py-1.5 text-center leading-tight ${dia === hoje ? 'bg-[#176b4d] text-white' : ehDomingo(dia) ? 'bg-slate-100 text-slate-500' : 'text-slate-700'}`}
                >
                  <span className="block text-xs font-bold uppercase">{dia === hoje ? 'hoje' : diaDaSemana(dia)}</span>
                  <span className="block text-xs font-bold tabular-nums">{diaMes(dia)}</span>
                </span>
              ))}
            </div>
            {[...frentes.entries()].map(([frente, lista]) => (
              <div role="rowgroup" key={frente}>
                <div role="row" className="grid border-b border-slate-200 bg-slate-50" style={grade}>
                  <span role="rowheader" className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase text-slate-800" style={{ gridColumn: `1 / span ${dias + 1}` }}>
                    {frente} <span className="font-semibold normal-case tracking-normal text-[#5b6870]">· {lista.length} {lista.length === 1 ? 'atividade' : 'atividades'}</span>
                  </span>
                </div>
                {lista.map(resumo => {
                  const { item } = resumo;
                  const de = posicao(item.dataInicio);
                  const ate = posicao(item.dataFim);
                  const cor = COR_SITUACAO[resumo.situacao];
                  return (
                    <div role="row" key={item.id} className="group relative grid min-h-11 border-b border-slate-100" style={grade}>
                      <span role="rowheader" className="sticky left-0 z-10 min-w-0 bg-white" style={{ gridColumn: 1, gridRow: 1 }}>
                        <button
                          type="button"
                          onClick={() => onAbrir(resumo)}
                          className="block h-full w-full min-w-0 px-3 py-1.5 text-left hover:bg-emerald-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--renea-focus)"
                          title={`${item.servicoDescricao} · ${item.responsavel || item.equipeNome || ''}`}
                        >
                          <span className="block truncate text-sm font-bold text-slate-900">{item.servicoDescricao}</span>
                          <span className="block truncate text-xs font-semibold text-[#5b6870]">{item.responsavel || item.equipeNome || 'Sem responsável'}</span>
                        </button>
                      </span>
                      {colunas.map((dia, indice) => (
                        <span
                          key={dia}
                          aria-hidden="true"
                          className={`border-l border-slate-100 ${dia === hoje ? 'bg-emerald-50' : ehDomingo(dia) ? 'bg-slate-50' : ''}`}
                          style={{ gridColumn: indice + 2, gridRow: 1 }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => onAbrir(resumo)}
                        className={`relative z-[1] flex h-7 min-w-0 items-center self-center overflow-hidden rounded-md px-2 text-xs font-bold shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus) ${cor.barra} ${item.dataInicio < inicio ? 'rounded-l-none' : ''} ${item.dataFim > fim ? 'rounded-r-none' : ''}`}
                        style={{ gridColumn: `${de + 2} / ${ate + 3}`, gridRow: 1 }}
                        aria-label={`${item.servicoDescricao}, ${item.frente || ''}: ${Math.round(resumo.percentual)}% feito, meta ${numeroObra(resumo.meta)} ${item.unidade} por dia`}
                      >
                        <span className="truncate">{Math.round(resumo.percentual)}% · {numeroObra(resumo.meta)} {item.unidade}/dia</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

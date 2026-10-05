import { useDeferredValue, useMemo, useState } from 'react';
import { Hammer, Pencil, Search, Trash2 } from 'lucide-react';
import type { CravacaoEstaca } from '../../types';
import { estaCravada, frenteDaEstaca, nomeDaEstaca, ordemDasEstacas } from '../../modules/estacas/avancoEstacas';
import { formatarData, numero } from '../../utils/formato';
import { ConfirmDialog, FilterBar } from '../../shared/ui';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PERIGO_LEVE, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, TOM_SITUACAO } from '../cadastros/estilos';

type Filtro = 'todas' | 'cravadas' | 'a-cravar';
const FILTROS: ReadonlyArray<{ id: Filtro; nome: string }> = [
  { id: 'todas', nome: 'Todas' },
  { id: 'cravadas', nome: 'Cravadas' },
  { id: 'a-cravar', nome: 'A cravar' },
];
const PAGINA = 100;

interface Props {
  estacas: readonly CravacaoEstaca[];
  frentes: readonly string[];
  onCravar: (estaca: CravacaoEstaca) => void;
  onEditar: (estaca: CravacaoEstaca) => void;
  onInativar: (ids: string[]) => void;
}

/** Todas as estacas, com busca, frente e situação. As ações ficam na própria linha. */
export default function ListaEstacas({ estacas, frentes, onCravar, onEditar, onInativar }: Props) {
  const [busca, setBusca] = useState('');
  const [frente, setFrente] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [limite, setLimite] = useState(PAGINA);
  const [confirmando, setConfirmando] = useState<string[] | null>(null);
  const termo = useDeferredValue(busca.trim().toLocaleLowerCase('pt-BR'));

  const visiveis = useMemo(() => estacas.filter(item => {
    if (frente && frenteDaEstaca(item) !== frente) return false;
    if (filtro === 'cravadas' && !estaCravada(item)) return false;
    if (filtro === 'a-cravar' && estaCravada(item)) return false;
    if (!termo) return true;
    return [nomeDaEstaca(item), frenteDaEstaca(item), item.item, item.responsavel, formatarData(item.data)]
      .some(valor => String(valor || '').toLocaleLowerCase('pt-BR').includes(termo));
  }).sort(ordemDasEstacas), [estacas, frente, filtro, termo]);

  const mostradas = visiveis.slice(0, limite);
  const lista = useEntradaDeLista<HTMLDivElement>([frente, filtro, termo]);
  const todasMarcadas = mostradas.length > 0 && mostradas.every(item => marcadas.includes(item.id));
  const alternar = (id: string) => setMarcadas(atual => (atual.includes(id) ? atual.filter(item => item !== id) : [...atual, id]));

  const situacao = (estaca: CravacaoEstaca) => (estaCravada(estaca)
    ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TOM_SITUACAO.ok}`}>Cravada</span>
    : <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TOM_SITUACAO.alerta}`}>A cravar</span>);

  const acoes = (estaca: CravacaoEstaca) => (
    <div className="flex justify-end gap-1">
      {estaCravada(estaca)
        ? <button type="button" onClick={() => onEditar(estaca)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}><Pencil className="size-4" aria-hidden="true" /> Corrigir</button>
        : <button type="button" onClick={() => onCravar(estaca)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}><Hammer className="size-4" aria-hidden="true" /> Cravar</button>}
      <button type="button" onClick={() => setConfirmando([estaca.id])} aria-label={`Tirar ${nomeDaEstaca(estaca)}`} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-rose-700 hover:bg-rose-50 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div data-estacas-reveal className="lg:sticky lg:top-0 lg:z-20 lg:-mt-2 lg:bg-white lg:pb-2 lg:pt-2">
        <FilterBar label="Filtros das estacas" className="rounded-2xl border border-slate-200 bg-white p-3">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Buscar estaca</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={busca} onChange={event => { setBusca(event.target.value); setLimite(PAGINA); }} placeholder="Estaca, frente, dia ou responsável" className={`${CAMPO} pl-11`} />
          </label>
          <label className="min-w-0 sm:w-56">
            <span className="sr-only">Frente</span>
            <select value={frente} onChange={event => { setFrente(event.target.value); setLimite(PAGINA); }} className={CAMPO}>
              <option value="">Todas as frentes</option>
              {frentes.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Mostrar só" className="flex basis-full gap-2 overflow-x-auto pb-1">
            {FILTROS.map(item => (
              <button key={item.id} type="button" aria-pressed={filtro === item.id} onClick={() => { setFiltro(item.id); setLimite(PAGINA); }} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition duration-200 ${FOCO} ${filtro === item.id ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}>{item.nome}</button>
            ))}
          </div>
        </FilterBar>
      </div>

      <div data-estacas-reveal className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
        <p className="text-slate-600">{visiveis.length.toLocaleString('pt-BR')} estaca(s){marcadas.length ? ` · ${marcadas.length} marcada(s)` : ''}</p>
        {marcadas.length > 0 && (
          <button type="button" onClick={() => setConfirmando(marcadas)} className={BOTAO_PERIGO_LEVE}><Trash2 className="size-4" aria-hidden="true" /> Tirar marcadas</button>
        )}
      </div>

      {!visiveis.length ? (
        <p data-estacas-reveal className={`${CARTAO} p-8 text-center text-sm font-semibold text-slate-500`}>Nenhuma estaca com esses filtros.</p>
      ) : (
        <div ref={lista} data-estacas-reveal>
          {/* Computador: tabela. */}
          <div className={`${CARTAO} max-md:hidden overflow-hidden`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f8f6] text-xs font-bold uppercase tracking-wide text-[#718087]">
                <tr>
                  <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Marcar todas" checked={todasMarcadas} onChange={event => setMarcadas(event.target.checked ? mostradas.map(item => item.id) : [])} className="size-4 accent-[#176b4d]" /></th>
                  <th className="px-3 py-3">Estaca</th>
                  <th className="px-3 py-3">Frente</th>
                  <th className="px-3 py-3">Dia</th>
                  <th className="px-3 py-3 text-right">Comprimento</th>
                  <th className="px-3 py-3 text-right">Cravado</th>
                  <th className="px-3 py-3 text-right">Sobra</th>
                  <th className="px-3 py-3">Situação</th>
                  <th className="px-3 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mostradas.map(item => (
                  <tr key={item.id} data-linha-lista className="hover:bg-emerald-50/40">
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Marcar ${nomeDaEstaca(item)}`} checked={marcadas.includes(item.id)} onChange={() => alternar(item.id)} className="size-4 accent-[#176b4d]" /></td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{nomeDaEstaca(item)}</td>
                    <td className="px-3 py-2 text-slate-700">{frenteDaEstaca(item)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">{estaCravada(item) ? formatarData(item.data) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{Number(item.comprimentoM) > 0 ? `${numero(item.comprimentoM, 2)} m` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{estaCravada(item) ? `${numero(item.comprimentoCravadoM, 2)} m` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{estaCravada(item) ? `${numero(item.sobraM, 2)} m` : '—'}</td>
                    <td className="px-3 py-2">{situacao(item)}</td>
                    <td className="px-3 py-1">{acoes(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões. */}
          <ul className="space-y-2 md:hidden">
            {mostradas.map(item => (
              <li key={item.id} data-linha-lista className={`${CARTAO} p-3`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" aria-label={`Marcar ${nomeDaEstaca(item)}`} checked={marcadas.includes(item.id)} onChange={() => alternar(item.id)} className="mt-1 size-5 accent-[#176b4d]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold text-slate-900">{nomeDaEstaca(item)}</p>
                      {situacao(item)}
                    </div>
                    <p className="text-sm text-slate-600">{frenteDaEstaca(item)}</p>
                    {estaCravada(item) && <p className="text-sm tabular-nums text-slate-700">{formatarData(item.data)} · {numero(item.comprimentoCravadoM, 2)} de {numero(item.comprimentoM, 2)} m · sobra {numero(item.sobraM, 2)} m</p>}
                  </div>
                </div>
                <div className="mt-1">{acoes(item)}</div>
              </li>
            ))}
          </ul>

          {visiveis.length > limite && (
            <div className="mt-3 text-center">
              <button type="button" onClick={() => setLimite(atual => atual + PAGINA)} className={BOTAO_SECUNDARIO}>Mostrar mais {Math.min(PAGINA, visiveis.length - limite)}</button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmando)}
        tone="warning"
        title={confirmando?.length === 1 ? 'Tirar esta estaca da lista?' : `Tirar ${confirmando?.length ?? 0} estacas da lista?`}
        description="Elas saem da tela, das contas e do desenho, mas continuam guardadas e podem voltar."
        confirmLabel="Tirar da lista"
        onConfirm={() => {
          if (confirmando) onInativar(confirmando);
          setMarcadas(atual => atual.filter(id => !confirmando?.includes(id)));
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
    </div>
  );
}

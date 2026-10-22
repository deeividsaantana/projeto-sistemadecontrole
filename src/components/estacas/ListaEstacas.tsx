import { useDeferredValue, useMemo, useState } from 'react';
import { Hammer, Pencil, Search, Trash2 } from 'lucide-react';
import type { CravacaoEstaca } from '../../types';
import { estaCravada, frenteDaEstaca, nomeDaEstaca, ordemDasEstacas } from '../../modules/estacas/avancoEstacas';
import { formatarData, numero } from '../../utils/formato';
import { ConfirmDialog, FilterBar, TabelaPadrao, type ColunaTabela } from '../../shared/ui';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PERIGO_LEVE, CAMPO, FOCO, TOM_SITUACAO } from '../cadastros/estilos';

type Filtro = 'todas' | 'cravadas' | 'a-cravar';
const FILTROS: ReadonlyArray<{ id: Filtro; nome: string }> = [
  { id: 'todas', nome: 'Todas' },
  { id: 'cravadas', nome: 'Cravadas' },
  { id: 'a-cravar', nome: 'A cravar' },
];

/** Botão de texto da linha: 44 px no toque, 32 px no computador (linha de 40 px). */
const BOTAO_LINHA = `inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold md:min-h-8 ${FOCO}`;

const metros = (valor: number | undefined) => `${numero(valor, 2)} m`;

const colunas: ColunaTabela<CravacaoEstaca>[] = [
  { chave: 'estaca', titulo: 'Estaca', larguraMinima: 120, render: item => <span className="font-semibold text-slate-900">{nomeDaEstaca(item)}</span>, dica: item => nomeDaEstaca(item), valorOrdenacao: item => nomeDaEstaca(item) },
  { chave: 'frente', titulo: 'Frente', larguraMinima: 140, render: item => frenteDaEstaca(item), valorOrdenacao: item => frenteDaEstaca(item) },
  { chave: 'dia', titulo: 'Dia', render: item => (estaCravada(item) ? <span className="tabular-nums">{formatarData(item.data)}</span> : '—'), valorOrdenacao: item => (estaCravada(item) ? item.data : '') },
  { chave: 'comprimento', titulo: 'Comprimento', alinhamento: 'direita', render: item => (Number(item.comprimentoM) > 0 ? metros(item.comprimentoM) : '—'), valorOrdenacao: item => Number(item.comprimentoM) || null },
  { chave: 'cravado', titulo: 'Cravado', alinhamento: 'direita', render: item => (estaCravada(item) ? <span className="font-semibold text-slate-900">{metros(item.comprimentoCravadoM)}</span> : '—'), valorOrdenacao: item => (estaCravada(item) ? Number(item.comprimentoCravadoM) : null) },
  { chave: 'sobra', titulo: 'Sobra', alinhamento: 'direita', render: item => (estaCravada(item) ? metros(item.sobraM) : '—'), valorOrdenacao: item => (estaCravada(item) ? Number(item.sobraM) : null) },
  {
    chave: 'situacao',
    titulo: 'Situação',
    render: item => (estaCravada(item)
      ? <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TOM_SITUACAO.ok}`}>Cravada</span>
      : <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TOM_SITUACAO.alerta}`}>A cravar</span>),
    valorOrdenacao: item => (estaCravada(item) ? 'Cravada' : 'A cravar'),
  },
];

interface Props {
  estacas: readonly CravacaoEstaca[];
  frentes: readonly string[];
  onCravar: (estaca: CravacaoEstaca) => void;
  onEditar: (estaca: CravacaoEstaca) => void;
  onInativar: (ids: string[]) => void;
}

/**
 * Todas as estacas, com busca, frente e situação, na TabelaPadrao: 50 por
 * página (dá para mostrar 25 ou 100), cartões no celular e as ações na
 * própria linha. Marcar várias tira da lista de uma vez, sem apagar.
 */
export default function ListaEstacas({ estacas, frentes, onCravar, onEditar, onInativar }: Props) {
  const [busca, setBusca] = useState('');
  const [frente, setFrente] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(() => new Set());
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

  const lista = useEntradaDeLista<HTMLDivElement>([frente, filtro, termo]);

  const alternar = (id: string) => setMarcadas(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });
  const alternarVarias = (ids: string[], marcar: boolean) => setMarcadas(atual => {
    const proximo = new Set(atual);
    ids.forEach(id => (marcar ? proximo.add(id) : proximo.delete(id)));
    return proximo;
  });

  const acoes = (estaca: CravacaoEstaca) => (
    <>
      {estaCravada(estaca)
        ? <button type="button" onClick={() => onEditar(estaca)} className={`${BOTAO_LINHA} text-[#176b4d] hover:bg-emerald-50`}><Pencil className="size-4" aria-hidden="true" /> Corrigir</button>
        : <button type="button" onClick={() => onCravar(estaca)} className={`${BOTAO_LINHA} text-[#176b4d] hover:bg-emerald-50`}><Hammer className="size-4" aria-hidden="true" /> Cravar</button>}
      <button type="button" onClick={() => setConfirmando([estaca.id])} aria-label={`Tirar ${nomeDaEstaca(estaca)}`} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-rose-700 hover:bg-rose-50 md:min-h-8 md:min-w-8 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div data-estacas-reveal className="shrink-0 space-y-2">
        <FilterBar label="Filtros das estacas" className="rounded-2xl border border-slate-200 bg-white p-3">
          <label className="relative block min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <span className="sr-only">Buscar estaca</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Estaca, frente, dia ou responsável" className={`${CAMPO} pl-11`} />
          </label>
          <label className="min-w-0 basis-full sm:w-56 sm:basis-auto">
            <span className="sr-only">Frente</span>
            <select value={frente} onChange={event => setFrente(event.target.value)} className={CAMPO}>
              <option value="">Todas as frentes</option>
              {frentes.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Mostrar só" className="flex gap-2 overflow-x-auto max-lg:basis-full">
            {FILTROS.map(item => (
              <button key={item.id} type="button" aria-pressed={filtro === item.id} onClick={() => setFiltro(item.id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition duration-200 ${FOCO} ${filtro === item.id ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}>{item.nome}</button>
            ))}
          </div>
        </FilterBar>

        {marcadas.size > 0 && (
          <div role="region" aria-label="Estacas marcadas" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-2 sm:pl-4">
            <p className="text-sm font-bold text-emerald-900" aria-live="polite">{marcadas.size.toLocaleString('pt-BR')} {marcadas.size === 1 ? 'marcada' : 'marcadas'}</p>
            <button type="button" onClick={() => setConfirmando([...marcadas])} className={BOTAO_PERIGO_LEVE}><Trash2 className="size-4" aria-hidden="true" /> Tirar marcadas</button>
          </div>
        )}
      </div>

      <div ref={lista} data-estacas-reveal className="flex min-h-0 flex-1 flex-col">
        <TabelaPadrao
          titulo="Estacas"
          linhas={visiveis}
          colunas={colunas}
          idDaLinha={item => item.id}
          nomeDoItem={{ um: 'estaca', varios: 'estacas' }}
          acoes={acoes}
          selecao={{ marcados: marcadas, onAlternar: alternar, onAlternarVarios: alternarVarias, rotulo: item => `Marcar ${nomeDaEstaca(item)}` }}
          vazio="Nenhuma estaca com esses filtros."
          testId="estacas-lista"
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirmando)}
        tone="warning"
        title={confirmando?.length === 1 ? 'Tirar esta estaca da lista?' : `Tirar ${confirmando?.length ?? 0} estacas da lista?`}
        description="Elas saem da tela, das contas e do desenho, mas continuam guardadas e podem voltar."
        confirmLabel="Tirar da lista"
        onConfirm={() => {
          if (confirmando) onInativar(confirmando);
          setMarcadas(atual => new Set([...atual].filter(id => !confirmando?.includes(id))));
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
    </div>
  );
}

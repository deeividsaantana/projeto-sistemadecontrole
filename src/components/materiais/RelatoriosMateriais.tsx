import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Factory, FileSpreadsheet, Layers, Minus, Package, Printer, Route, type LucideIcon } from 'lucide-react';
import type { EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import {
  SEM_FORNECEDOR,
  diasDoPeriodo,
  filtrarRelatorio,
  indicadores,
  mesAMes,
  paraCsv,
  periodoAnterior,
  porDia,
  porFornecedor,
  porMaterial,
  porRamo,
  ramoDoMovimento,
  somaVazia,
  somar,
  type FiltroRelatorio,
  type Indicador,
  type LinhaRelatorio,
} from '../../modules/materials/relatoriosMateriais';
import { nomeDoMes, ramosDaObra } from '../../modules/materials/previstoMateriais';
import { formatarData, moeda, numero } from '../../utils/formato';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

type Relatorio = 'material' | 'fornecedor' | 'ramo' | 'mes' | 'dia';

const RELATORIOS: ReadonlyArray<{ id: Relatorio; nome: string; Icone: LucideIcon }> = [
  { id: 'material', nome: 'Por material', Icone: Package },
  { id: 'fornecedor', nome: 'Por fornecedor', Icone: Factory },
  { id: 'ramo', nome: 'Por ramo', Icone: Route },
  { id: 'mes', nome: 'Mês a mês', Icone: Layers },
  { id: 'dia', nome: 'Dia a dia', Icone: CalendarDays },
];

const TIPOS: ReadonlyArray<{ id: TipoMovimentoMaterial | ''; nome: string }> = [
  { id: 'Entrada', nome: 'Chegou' },
  { id: 'Saída', nome: 'Saiu' },
  { id: 'Transferência', nome: 'Transporte' },
  { id: '', nome: 'Tudo' },
];

const INDICADOR: Record<Indicador['chave'], { nome: string; formatar: (valor: number) => string }> = {
  lancamentos: { nome: 'Lançamentos', formatar: valor => valor.toLocaleString('pt-BR') },
  toneladas: { nome: 'Toneladas', formatar: valor => `${numero(valor, 1)} t` },
  metrosCubicos: { nome: 'Metros cúbicos', formatar: valor => `${numero(valor, 1)} m³` },
  valor: {
    nome: 'Valor',
    // O cartão é estreito: "R$ 499.203,61" vira "R$ 499 mil"; o número inteiro fica no toque longo e nas tabelas.
    formatar: valor => (valor >= 1_000_000 ? `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : valor >= 10_000 ? `R$ ${Math.round(valor / 1000).toLocaleString('pt-BR')} mil` : moeda(valor)),
  },
  fornecedores: { nome: 'Fornecedores', formatar: valor => valor.toLocaleString('pt-BR') },
  porDia: { nome: 'Lançamentos por dia', formatar: valor => numero(valor, 1) },
};

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const outrasEmTexto = (outras: Record<string, number>) => Object.entries(outras).map(([unidade, total]) => `${numero(total, 1)} ${unidade}`).join(' · ');
const primeiroDoMes = (dia: string) => `${dia.slice(0, 7)}-01`;
const ultimoDoMes = (dia: string) => {
  const [ano, mes] = dia.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
};
const somarDias = (dia: string, dias: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

interface Props {
  hoje: string;
  materiais: readonly Material[];
  movimentos: readonly MovimentoMaterial[];
  etapas: readonly EtapaServico[];
}

/**
 * Relatórios de Materiais: escolhe o período e os filtros uma vez, vê os
 * indicadores comparados com o período anterior e troca de relatório por
 * abas. Cada relatório baixa em planilha e imprime do jeito que está na tela.
 */
export default function RelatoriosMateriais({ hoje, materiais, movimentos, etapas }: Props) {
  const [filtro, setFiltro] = useState<FiltroRelatorio>(() => ({ de: primeiroDoMes(hoje), ate: hoje, tipo: 'Entrada', materialId: '', fornecedor: '', ramo: '' }));
  const [relatorio, setRelatorio] = useState<Relatorio>('material');
  const mudar = (parte: Partial<FiltroRelatorio>) => setFiltro(atual => ({ ...atual, ...parte }));

  const ramoDe = useMemo(() => ramoDoMovimento(etapas), [etapas]);
  const doPeriodo = useMemo(() => filtrarRelatorio(movimentos, filtro, ramoDe), [filtro, movimentos, ramoDe]);
  const anterior = useMemo(() => periodoAnterior(filtro.de, filtro.ate), [filtro.ate, filtro.de]);
  const doAnterior = useMemo(() => filtrarRelatorio(movimentos, { ...filtro, ...anterior }, ramoDe), [anterior, filtro, movimentos, ramoDe]);
  const numeros = useMemo(() => indicadores(doPeriodo, doAnterior, diasDoPeriodo(filtro.de, filtro.ate)), [doAnterior, doPeriodo, filtro.ate, filtro.de]);

  const opcoes = useMemo(() => {
    const usados = new Set(movimentos.map(item => item.materialId));
    const fornecedores = [...new Set(movimentos.map(item => item.fornecedorNome?.trim()).filter((nome): nome is string => Boolean(nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      materiais: materiais.filter(item => usados.has(item.id)).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
      fornecedores,
      ramos: ramosDaObra(etapas),
    };
  }, [etapas, materiais, movimentos]);

  const linhas = useMemo((): LinhaRelatorio[] => {
    if (relatorio === 'material') return porMaterial(doPeriodo);
    if (relatorio === 'fornecedor') return porFornecedor(doPeriodo);
    if (relatorio === 'ramo') return porRamo(doPeriodo, ramoDe);
    if (relatorio === 'dia') return porDia(doPeriodo);
    return [];
  }, [doPeriodo, ramoDe, relatorio]);
  const matriz = useMemo(() => (relatorio === 'mes' ? mesAMes(doPeriodo) : null), [doPeriodo, relatorio]);
  const total = useMemo(() => doPeriodo.reduce(somar, somaVazia()), [doPeriodo]);

  const nomeRelatorio = RELATORIOS.find(item => item.id === relatorio)?.nome ?? '';
  const nomeTipo = TIPOS.find(item => item.id === filtro.tipo)?.nome ?? 'Tudo';
  const material = materiais.find(item => item.id === filtro.materialId);
  const filtrosAtivos = [material?.descricao, filtro.fornecedor, filtro.ramo].filter(Boolean) as string[];
  const periodoEscrito = `${formatarData(filtro.de)} a ${formatarData(filtro.ate)}`;
  const nomeDaLinha = (linha: LinhaRelatorio) => (relatorio === 'dia' ? formatarData(linha.nome) : linha.nome);

  const atalhos = [
    { nome: 'Este mês', de: primeiroDoMes(hoje), ate: hoje },
    { nome: 'Mês passado', de: primeiroDoMes(somarDias(primeiroDoMes(hoje), -1)), ate: ultimoDoMes(somarDias(primeiroDoMes(hoje), -1)) },
    { nome: 'Últimos 30 dias', de: somarDias(hoje, -29), ate: hoje },
    { nome: 'Tudo', de: movimentos.reduce((menor, item) => (item.data && item.data < menor ? item.data : menor), hoje), ate: hoje },
  ];

  const baixar = () => {
    const tabela: Array<Array<string | number>> = matriz
      ? [['Material', 'Unidade', ...matriz.meses.map(nomeDoMes), 'Total'], ...matriz.linhas.map(linha => [linha.nome, linha.unidade, ...matriz.meses.map(mes => linha.porMes[mes] || 0), linha.total])]
      : [
        [relatorio === 'dia' ? 'Dia' : relatorio === 'material' ? 'Material' : relatorio === 'fornecedor' ? 'Fornecedor' : 'Ramo', 'Lançamentos', 'Toneladas', 'Metros cúbicos', 'Outras unidades', 'Valor (R$)', 'Último'],
        ...linhas.map(linha => [nomeDaLinha(linha), linha.lancamentos, linha.toneladas, linha.metrosCubicos, outrasEmTexto(linha.outras), linha.valor, linha.ultima ? formatarData(linha.ultima) : '']),
        ['Total', total.lancamentos, total.toneladas, total.metrosCubicos, outrasEmTexto(total.outras), total.valor, ''],
      ];
    const url = URL.createObjectURL(new Blob([paraCsv(tabela)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `materiais-${nomeRelatorio.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-')}-${filtro.de}-a-${filtro.ate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const vazio = doPeriodo.length === 0;

  return (
    <div className="space-y-4">
      <section data-materiais-reveal aria-label="Período e filtros do relatório" className={`${CARTAO} space-y-3 p-4 print:hidden`}>
        <div className="flex flex-wrap gap-2">
          {atalhos.map(item => {
            const ativo = filtro.de === item.de && filtro.ate === item.ate;
            return (
              <button key={item.nome} type="button" aria-pressed={ativo} onClick={() => mudar({ de: item.de, ate: item.ate })} className={`min-h-10 rounded-full border px-4 text-sm font-bold transition duration-200 ${FOCO} ${ativo ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}>
                {item.nome}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="block space-y-1">
            <span className={ROTULO}>De</span>
            <input type="date" value={filtro.de} max={filtro.ate} onChange={event => event.target.value && mudar({ de: event.target.value })} className={CAMPO} />
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Até</span>
            <input type="date" value={filtro.ate} min={filtro.de} onChange={event => event.target.value && mudar({ ate: event.target.value })} className={CAMPO} />
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Mostrar</span>
            <select value={filtro.tipo} onChange={event => mudar({ tipo: event.target.value as FiltroRelatorio['tipo'] })} className={CAMPO}>
              {TIPOS.map(item => <option key={item.nome} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Material</span>
            <select value={filtro.materialId} onChange={event => mudar({ materialId: event.target.value })} className={CAMPO}>
              <option value="">Todos</option>
              {opcoes.materiais.map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Fornecedor</span>
            <select value={filtro.fornecedor} onChange={event => mudar({ fornecedor: event.target.value })} className={CAMPO}>
              <option value="">Todos</option>
              {opcoes.fornecedores.map(item => <option key={item} value={item}>{item}</option>)}
              <option value={SEM_FORNECEDOR}>{SEM_FORNECEDOR}</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Ramo</span>
            <select value={filtro.ramo} onChange={event => mudar({ ramo: event.target.value })} className={CAMPO}>
              <option value="">Todos</option>
              {opcoes.ramos.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {filtrosAtivos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">Filtrando por <strong className="text-slate-900">{filtrosAtivos.join(', ')}</strong></p>
            <button type="button" onClick={() => mudar({ materialId: '', fornecedor: '', ramo: '' })} className={BOTAO_SECUNDARIO}>Limpar filtros</button>
          </div>
        )}
      </section>

      <section data-materiais-reveal aria-label="Indicadores do período" className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6 print:hidden">
        {numeros.map(item => {
          const Seta = item.variacao === null || item.variacao === 0 ? Minus : item.variacao > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <article key={item.chave} className={`${CARTAO} p-4`}>
              <p className="text-sm font-semibold text-slate-600">{INDICADOR[item.chave].nome}</p>
              <strong className="mt-1 block truncate text-2xl font-black tabular-nums text-slate-950" title={item.chave === 'valor' ? moeda(item.valor) : INDICADOR[item.chave].formatar(item.valor)}>{INDICADOR[item.chave].formatar(item.valor)}</strong>
              <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Seta className="size-3.5 shrink-0" aria-hidden="true" />
                {item.variacao === null ? 'nada no período anterior' : `${item.variacao > 0 ? '+' : ''}${item.variacao}% sobre o anterior`}
              </span>
            </article>
          );
        })}
      </section>
      <p className="-mt-2 px-1 text-xs text-slate-500 print:hidden">Período anterior comparado: {formatarData(anterior.de)} a {formatarData(anterior.ate)}.</p>

      <section id="materiais-relatorio-impressao" data-materiais-reveal aria-labelledby="materiais-relatorio-titulo" className={`${CARTAO} overflow-hidden`}>
        <div role="tablist" aria-label="Relatórios" className="flex flex-wrap gap-1 border-b border-slate-100 p-2 print:hidden">
          {RELATORIOS.map(({ id, nome, Icone }) => {
            const ativo = relatorio === id;
            return (
              <button key={id} type="button" role="tab" aria-selected={ativo} data-testid={`relatorio-${id}`} onClick={() => setRelatorio(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition duration-200 ${FOCO} ${ativo ? 'bg-[#176b4d] text-white' : 'text-slate-700 hover:bg-emerald-50 hover:text-[#176b4d]'}`}>
                <Icone className="size-4" aria-hidden="true" />
                {nome}
              </button>
            );
          })}
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="materiais-relatorio-titulo" className="text-base font-bold text-slate-900">{nomeRelatorio} · {nomeTipo}</h2>
            <p className="text-sm text-slate-500">
              {periodoEscrito} · {total.lancamentos.toLocaleString('pt-BR')} lançamento(s){filtrosAtivos.length ? ` · ${filtrosAtivos.join(', ')}` : ''}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row print:hidden">
            <button type="button" onClick={() => window.print()} disabled={vazio} className={BOTAO_SECUNDARIO}>
              <Printer className="size-4" aria-hidden="true" />
              Imprimir
            </button>
            <button type="button" onClick={baixar} disabled={vazio} className={BOTAO_PRIMARIO}>
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Baixar planilha
            </button>
          </div>
        </header>

        {vazio ? (
          <p className="px-4 pb-10 pt-6 text-center text-sm text-slate-500">Nada lançado com esse período e esses filtros. Tente "Tudo" ou limpe os filtros.</p>
        ) : matriz ? (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50 p-3">Material</th>
                  {matriz.meses.map(mes => <th key={mes} scope="col" className="whitespace-nowrap p-3 text-right">{mesCurto(mes)}</th>)}
                  <th scope="col" className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matriz.linhas.map(linha => (
                  <tr key={linha.chave}>
                    <th scope="row" className="sticky left-0 z-10 max-w-[12rem] bg-white p-3 font-semibold text-slate-800">
                      <span className="block truncate" title={linha.nome}>{linha.nome}</span>
                      <span className="text-xs font-normal text-slate-500">{linha.unidade}</span>
                    </th>
                    {matriz.meses.map(mes => <td key={mes} className="whitespace-nowrap p-3 text-right tabular-nums text-slate-700">{linha.porMes[mes] ? numero(linha.porMes[mes], 1) : '-'}</td>)}
                    <td className="whitespace-nowrap p-3 text-right font-black tabular-nums text-slate-950">{numero(linha.total, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-t border-slate-100 sm:block print:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="p-3">{relatorio === 'dia' ? 'Dia' : relatorio === 'material' ? 'Material' : relatorio === 'fornecedor' ? 'Fornecedor' : 'Ramo'}</th>
                    <th scope="col" className="p-3 text-right">Lançamentos</th>
                    <th scope="col" className="p-3 text-right">Toneladas</th>
                    <th scope="col" className="p-3 text-right">m³</th>
                    <th scope="col" className="p-3 text-right">Outras</th>
                    <th scope="col" className="p-3 text-right">Valor</th>
                    <th scope="col" className="p-3 text-right">% do valor</th>
                    {relatorio !== 'dia' && <th scope="col" className="p-3 text-right">Último</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhas.map(linha => (
                    <tr key={linha.chave}>
                      <th scope="row" className="p-3 font-semibold text-slate-800">
                        {nomeDaLinha(linha)}
                        {linha.detalhe && <span className="ml-1 text-xs font-normal text-slate-500">({linha.detalhe})</span>}
                      </th>
                      <td className="p-3 text-right tabular-nums text-slate-700">{linha.lancamentos.toLocaleString('pt-BR')}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-700">{linha.toneladas ? numero(linha.toneladas, 1) : '-'}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-700">{linha.metrosCubicos ? numero(linha.metrosCubicos, 1) : '-'}</td>
                      <td className="p-3 text-right tabular-nums text-slate-700">{outrasEmTexto(linha.outras) || '-'}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-900">{linha.valor ? moeda(linha.valor) : '-'}</td>
                      <td className="p-3 text-right font-bold tabular-nums text-slate-900">{total.valor ? `${Math.round((linha.valor / total.valor) * 100)}%` : '-'}</td>
                      {relatorio !== 'dia' && <td className="whitespace-nowrap p-3 text-right tabular-nums text-slate-500">{linha.ultima ? formatarData(linha.ultima) : '-'}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-950">
                  <tr>
                    <th scope="row" className="p-3">Total</th>
                    <td className="p-3 text-right tabular-nums">{total.lancamentos.toLocaleString('pt-BR')}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">{total.toneladas ? numero(total.toneladas, 1) : '-'}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">{total.metrosCubicos ? numero(total.metrosCubicos, 1) : '-'}</td>
                    <td className="p-3 text-right tabular-nums">{outrasEmTexto(total.outras) || '-'}</td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">{total.valor ? moeda(total.valor) : '-'}</td>
                    <td className="p-3 text-right tabular-nums">{total.valor ? '100%' : '-'}</td>
                    {relatorio !== 'dia' && <td className="p-3" />}
                  </tr>
                </tfoot>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 border-t border-slate-100 sm:hidden print:hidden">
              {linhas.map(linha => (
                <li key={linha.chave} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="min-w-0 text-base text-slate-900">{nomeDaLinha(linha)}{linha.detalhe ? <span className="ml-1 text-sm font-normal text-slate-500">({linha.detalhe})</span> : null}</strong>
                    <span className="shrink-0 text-base font-black tabular-nums text-slate-950">{linha.valor ? moeda(linha.valor) : `${linha.lancamentos.toLocaleString('pt-BR')} lanç.`}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {[
                      `${linha.lancamentos.toLocaleString('pt-BR')} lançamento(s)`,
                      linha.toneladas ? `${numero(linha.toneladas, 1)} t` : '',
                      linha.metrosCubicos ? `${numero(linha.metrosCubicos, 1)} m³` : '',
                      outrasEmTexto(linha.outras),
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {linha.ultima && relatorio !== 'dia' && <p className="text-xs text-slate-500">Último em {formatarData(linha.ultima)}</p>}
                </li>
              ))}
              <li className="bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-base text-slate-950">Total</strong>
                  <strong className="text-base tabular-nums text-slate-950">{total.valor ? moeda(total.valor) : `${total.lancamentos.toLocaleString('pt-BR')} lanç.`}</strong>
                </div>
                <p className="mt-1 text-sm text-slate-600">{[`${total.lancamentos.toLocaleString('pt-BR')} lançamento(s)`, total.toneladas ? `${numero(total.toneladas, 1)} t` : '', total.metrosCubicos ? `${numero(total.metrosCubicos, 1)} m³` : '', outrasEmTexto(total.outras)].filter(Boolean).join(' · ')}</p>
              </li>
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

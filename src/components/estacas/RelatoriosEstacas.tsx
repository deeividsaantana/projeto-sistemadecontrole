import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { CalendarDays, FileSpreadsheet, ListOrdered, MapPinned, Printer, type LucideIcon } from 'lucide-react';
import type { CravacaoEstaca } from '../../types';
import {
  cravacoesPorDia,
  estaCravada,
  estacasPorFrente,
  frenteDaEstaca,
  nomeDaEstaca,
  ordemDasEstacas,
  paraCsv,
} from '../../modules/estacas/avancoEstacas';
import { formatarData, numero } from '../../utils/formato';
import { CountUp, TabelaPadrao, type ColunaTabela } from '../../shared/ui';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

type Relatorio = 'frente' | 'dia' | 'estacas';
const RELATORIOS: ReadonlyArray<{ id: Relatorio; nome: string; Icone: LucideIcon }> = [
  { id: 'frente', nome: 'Por frente', Icone: MapPinned },
  { id: 'dia', nome: 'Dia a dia', Icone: CalendarDays },
  { id: 'estacas', nome: 'Estaca por estaca', Icone: ListOrdered },
];

interface Props {
  hoje: string;
  estacas: readonly CravacaoEstaca[];
}

const noPeriodo = (estaca: CravacaoEstaca, de: string, ate: string) => {
  const dia = String(estaca.data || '').slice(0, 10);
  return (!de || dia >= de) && (!ate || dia <= ate);
};

/**
 * Relatórios das estacas: escolhe o período, vê os números do período e troca
 * entre por frente, dia a dia e estaca por estaca. Cada um baixa em planilha
 * e imprime como está na tela.
 */
export default function RelatoriosEstacas({ hoje, estacas }: Props) {
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`);
  const [ate, setAte] = useState(hoje);
  const [relatorio, setRelatorio] = useState<Relatorio>('frente');

  const doPeriodo = useMemo(() => estacas.filter(item => estaCravada(item) && noPeriodo(item, de, ate)), [estacas, de, ate]);
  const dias = useMemo(() => cravacoesPorDia(estacas, de, ate), [estacas, de, ate]);
  const frentes = useMemo(() => estacasPorFrente(estacas).map(frente => {
    const periodo = frente.estacas.filter(item => estaCravada(item) && noPeriodo(item, de, ate));
    return { ...frente, noPeriodo: periodo.length, metrosNoPeriodo: periodo.reduce((soma, item) => soma + Number(item.comprimentoCravadoM || 0), 0) };
  }), [estacas, de, ate]);

  const metros = doPeriodo.reduce((soma, item) => soma + Number(item.comprimentoCravadoM || 0), 0);
  const perda = doPeriodo.reduce((soma, item) => soma + Number(item.perdaM || 0), 0);
  const media = dias.length ? doPeriodo.length / dias.length : 0;
  const lista = useEntradaDeLista<HTMLDivElement>([relatorio, de, ate]);

  const tabela: (string | number)[][] = relatorio === 'frente'
    ? [
      ['Frente', 'Previstas', 'Cravadas', 'Faltam', 'Concluído (%)', 'Cravadas no período', 'Metros no período'],
      ...frentes.map(item => [item.frente, item.previstas, item.cravadas, item.faltam, item.porcentagem, item.noPeriodo, item.metrosNoPeriodo]),
    ]
    : relatorio === 'dia'
      ? [
        ['Dia', 'Estacas cravadas', 'Metros cravados', 'Perda (m)', 'Frentes'],
        ...dias.map(dia => [formatarData(dia.data), dia.cravadas, dia.metros, dia.perdaM, dia.frentes.join(', ')]),
      ]
      : [
        ['Dia', 'Frente', 'Estaca', 'Comprimento (m)', 'Cravado (m)', 'Sobra (m)', 'Perda (m)', 'Responsável'],
        ...[...doPeriodo].sort((a, b) => a.data.localeCompare(b.data) || ordemDasEstacas(a, b)).map(item => [
          formatarData(item.data), frenteDaEstaca(item), nomeDaEstaca(item), item.comprimentoM, item.comprimentoCravadoM, item.sobraM, item.perdaM, item.responsavel,
        ]),
      ];
  const vazio = tabela.length <= 1;

  type Linha = { id: string; celulas: (string | number)[] };
  const linhas = useMemo<Linha[]>(() => tabela.slice(1).map((celulas, indice) => ({ id: `${relatorio}-${indice}`, celulas })), [tabela, relatorio]);
  const colunas = useMemo<ColunaTabela<Linha>[]>(() => tabela[0].map((titulo, indice) => {
    const numerica = indice > 0 && typeof tabela[1]?.[indice] === 'number';
    return {
      chave: `c${indice}`,
      titulo: String(titulo),
      alinhamento: numerica ? 'direita' as const : undefined,
      larguraMinima: indice === 0 ? 110 : undefined,
      render: (linha: Linha) => {
        const celula = linha.celulas[indice];
        const texto = typeof celula === 'number' ? numero(celula, 2) : celula;
        return indice === 0 ? <span className="font-semibold text-slate-900">{texto}</span> : texto;
      },
      dica: (linha: Linha) => String(linha.celulas[indice] ?? ''),
      valorOrdenacao: (linha: Linha) => linha.celulas[indice],
    };
  }), [tabela]);

  // A tela mostra 50 linhas por página; no papel sai o relatório inteiro.
  // A tabela de impressão só existe enquanto imprime (menos peso na tela).
  const [imprimindo, setImprimindo] = useState(false);
  useEffect(() => {
    const antes = () => flushSync(() => setImprimindo(true));
    const depois = () => setImprimindo(false);
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', depois);
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois); };
  }, []);
  const imprimir = () => {
    flushSync(() => setImprimindo(true));
    window.print();
    setImprimindo(false);
  };

  const baixar = () => {
    const nome = RELATORIOS.find(item => item.id === relatorio)?.nome.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-') ?? 'relatorio';
    const url = URL.createObjectURL(new Blob([paraCsv(tabela)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `estacas-${nome}-${de || 'inicio'}-a-${ate || 'hoje'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const indicadores = [
    { nome: 'Estacas cravadas', valor: doPeriodo.length, formato: (valor: number) => Math.round(valor).toLocaleString('pt-BR') },
    { nome: 'Metros cravados', valor: metros, formato: (valor: number) => `${numero(valor, 1)} m` },
    { nome: 'Dias com cravação', valor: dias.length, formato: (valor: number) => Math.round(valor).toLocaleString('pt-BR') },
    { nome: 'Média por dia', valor: media, formato: (valor: number) => numero(valor, 1) },
    { nome: 'Perda', valor: perda, formato: (valor: number) => `${numero(valor, 1)} m` },
  ];

  return (
    <div className="space-y-4">
      <section data-estacas-reveal className={`${CARTAO} estacas-nao-imprime p-4`} aria-label="Período">
        <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          <label className="min-w-0 space-y-1.5">
            <span className={ROTULO}>De</span>
            <input type="date" value={de} onChange={event => setDe(event.target.value)} className={CAMPO} />
          </label>
          <label className="min-w-0 space-y-1.5">
            <span className={ROTULO}>Até</span>
            <input type="date" value={ate} onChange={event => setAte(event.target.value)} className={CAMPO} />
          </label>
          <button type="button" onClick={() => { setDe(`${hoje.slice(0, 7)}-01`); setAte(hoje); }} className={BOTAO_SECUNDARIO}>Este mês</button>
          <button type="button" onClick={() => { setDe(''); setAte(''); }} className={BOTAO_SECUNDARIO}>Desde o começo</button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {indicadores.map(item => (
          <div key={item.nome} data-estacas-reveal className={`${CARTAO} estacas-vivo p-4 ${item.nome === 'Perda' ? 'max-md:col-span-2' : ''}`}>
            <p className="text-sm font-semibold text-slate-600">{item.nome}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-900"><CountUp value={item.valor} format={item.formato} /></p>
          </div>
        ))}
      </div>

      <section data-estacas-reveal className={`${CARTAO} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Tipo de relatório" className="estacas-nao-imprime flex gap-2 overflow-x-auto pb-1">
            {RELATORIOS.map(({ id, nome, Icone }) => (
              <button key={id} type="button" aria-pressed={relatorio === id} onClick={() => setRelatorio(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition duration-200 ${FOCO} ${relatorio === id ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}>
                <Icone className="size-4" aria-hidden="true" /> {nome}
              </button>
            ))}
          </div>
          <div className="estacas-nao-imprime flex flex-wrap gap-2">
            <button type="button" onClick={imprimir} disabled={vazio} className={BOTAO_SECUNDARIO}><Printer className="size-5" aria-hidden="true" /> Imprimir</button>
            <button type="button" onClick={baixar} disabled={vazio} className={BOTAO_PRIMARIO}><FileSpreadsheet className="size-5" aria-hidden="true" /> Baixar planilha</button>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          {de || ate ? `De ${de ? formatarData(de) : 'o começo'} até ${ate ? formatarData(ate) : 'hoje'}` : 'Desde o começo'}
          {relatorio === 'frente' ? '. Previstas, cravadas e faltam contam a obra toda; as duas últimas colunas, só o período.' : '.'}
        </p>

        {vazio ? (
          <p className="mt-4 rounded-xl bg-[#f7f8f6] p-6 text-center text-sm font-semibold text-slate-500">Nenhuma estaca cravada neste período.</p>
        ) : (
          <div ref={lista} className="mt-3">
            <div className="estacas-nao-imprime">
              <TabelaPadrao
                key={relatorio}
                titulo={`Relatório ${RELATORIOS.find(item => item.id === relatorio)?.nome.toLocaleLowerCase('pt-BR')}`}
                linhas={linhas}
                colunas={colunas}
                idDaLinha={linha => linha.id}
                nomeDoItem={relatorio === 'frente' ? { um: 'frente', varios: 'frentes' } : relatorio === 'dia' ? { um: 'dia', varios: 'dias' } : { um: 'estaca', varios: 'estacas' }}
                testId="estacas-relatorio"
              />
            </div>
            {imprimindo && (
              <table className="hidden w-full text-left text-sm print:table">
                <caption className="mb-2 text-left font-bold">Estacas: {RELATORIOS.find(item => item.id === relatorio)?.nome}</caption>
                <thead>
                  <tr>{tabela[0].map((titulo, indice) => <th key={String(titulo)} scope="col" className={`border-b px-2 py-1 ${indice > 0 && typeof tabela[1]?.[indice] === 'number' ? 'text-right' : ''}`}>{titulo}</th>)}</tr>
                </thead>
                <tbody>
                  {tabela.slice(1).map((linha, indiceLinha) => (
                    <tr key={indiceLinha}>
                      {linha.map((celula, indice) => (
                        <td key={indice} className={`border-b px-2 py-1 ${typeof celula === 'number' ? 'text-right tabular-nums' : ''}`}>{typeof celula === 'number' ? numero(celula, 2) : celula}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

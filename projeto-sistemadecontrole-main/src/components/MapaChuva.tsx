/**
 * Mapa de chuvas do mês: o quadro que a obra leva para justificar prazo. Cada
 * quadradinho é um dia, e a cor diz o quanto choveu. Ele lê o pluviômetro
 * lançado no diário — não guarda número próprio, para não existirem duas
 * verdades sobre o mesmo dia.
 */
import { useMemo, useState } from 'react';
import { CloudRain, Download, Umbrella } from 'lucide-react';
import type { DiarioObra } from '../types';
import {
  ROTULO_FAIXA,
  faixaDaChuva,
  mesesComDiario,
  montarMesDeChuva,
  type FaixaChuva,
} from '../utils/mapaChuva';
import { OBRA } from '../config/obra';

interface MapaChuvaProps {
  diarios: DiarioObra[];
  responsavel?: string;
}

/** Grandeza se lê do claro ao escuro, num tom só. Nunca arco-íris. */
const CORES_FAIXA: Record<FaixaChuva, { fundo: string; texto: string; borda: string }> = {
  'sem-diario': { fundo: '#f4f5f3', texto: '#9aa3a8', borda: '#e2e8e4' },
  seco: { fundo: '#ffffff', texto: '#5b6b63', borda: '#e2e8e4' },
  fraca: { fundo: '#dbeafe', texto: '#1e3a5f', borda: '#bfdbfe' },
  moderada: { fundo: '#93c5fd', texto: '#10243d', borda: '#60a5fa' },
  forte: { fundo: '#3b82f6', texto: '#ffffff', borda: '#2563eb' },
  'muito-forte': { fundo: '#1d4ed8', texto: '#ffffff', borda: '#1e40af' },
};

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const hoje = new Date();

export default function MapaChuva({ diarios, responsavel = '' }: MapaChuvaProps) {
  const meses = useMemo(() => {
    const encontrados = mesesComDiario(diarios);
    return encontrados.length > 0
      ? encontrados
      : [{ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }];
  }, [diarios]);

  const [selecionado, setSelecionado] = useState(`${meses[0].ano}-${meses[0].mes}`);
  const [ano, mes] = selecionado.split('-').map(Number);
  const dados = useMemo(() => montarMesDeChuva(diarios, ano, mes), [diarios, ano, mes]);

  // O primeiro dia do mês nem sempre cai no domingo: o calendário precisa da
  // folga inicial para o dia 10 ficar embaixo da quarta certa.
  const folgaInicial = new Date(ano, mes - 1, 1).getDay();

  const exportarPdf = async () => {
    const { generateUniversalPdfReport } = await import('../utils/universalPdfReport');
    await generateUniversalPdfReport({
      title: 'Mapa de chuvas',
      subtitle: dados.rotulo,
      work: OBRA.nome,
      period: dados.rotulo,
      issuedBy: responsavel,
      orientation: 'portrait',
      fileName: `mapa-de-chuvas-${ano}-${String(mes).padStart(2, '0')}.pdf`,
      columns: [
        { header: 'Dia', dataKey: 'dia' },
        { header: 'Pluviômetro (mm)', dataKey: 'mm' },
        { header: 'Intensidade', dataKey: 'faixa' },
        { header: 'Clima manhã', dataKey: 'manha' },
        { header: 'Clima tarde', dataKey: 'tarde' },
        { header: 'Horas paradas', dataKey: 'horas' },
      ],
      rows: dados.dias.map(dia => ({
        dia: String(dia.dia).padStart(2, '0'),
        mm: dia.milimetros === null ? '—' : dia.milimetros.toLocaleString('pt-BR'),
        faixa: ROTULO_FAIXA[faixaDaChuva(dia.milimetros)],
        manha: dia.climaManha || '—',
        tarde: dia.climaTarde || '—',
        horas: dia.horasParadas ? dia.horasParadas.toLocaleString('pt-BR') : '—',
      })),
      summary: [
        { label: 'Total no mês', value: `${dados.totalMm.toLocaleString('pt-BR')} mm` },
        { label: 'Dias com chuva', value: dados.diasComChuva },
        { label: 'Dias impraticáveis', value: dados.diasImpraticaveis },
        { label: 'Horas paradas por clima', value: dados.horasParadas.toLocaleString('pt-BR') },
        { label: 'Dias sem diário', value: dados.diasSemDiario },
      ],
    });
  };

  return (
    <section id="mapa-de-chuvas" className="rounded-xl border border-[#e2e8e4] bg-white">
      <header className="relative overflow-hidden border-b border-[#e2e8e4] px-4 py-4 sm:px-5">
        {/* As nuvens andam devagar atrás do título. É só transform e opacity,
            e param de vez para quem pede movimento reduzido. */}
        <div className="mapa-chuva__ceu" aria-hidden="true">
          {[0, 1, 2].map(indice => (
            <svg key={indice} className={`mapa-chuva__nuvem mapa-chuva__nuvem--${indice}`} viewBox="0 0 120 48" width="120" height="48">
              <path
                d="M26 38h62a15 15 0 0 0 1-30 20 20 0 0 0-37-6 14 14 0 0 0-26 9A13 13 0 0 0 26 38Z"
                fill="#bfdbfe"
              />
              {[38, 54, 70].map(x => (
                <line key={x} x1={x} y1="40" x2={x - 4} y2="47" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
              ))}
            </svg>
          ))}
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CloudRain className="h-6 w-6 text-blue-700" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-black leading-tight text-[#101a22]">Mapa de chuvas</h2>
              <p className="text-xs text-[#65716b]">Alimentado pelo pluviômetro lançado no diário do dia.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label>
              <span className="sr-only">Mês do mapa</span>
              <select
                value={selecionado}
                onChange={event => setSelecionado(event.target.value)}
                className="min-h-11 rounded-lg border border-[#e2e8e4] bg-white px-3 text-sm font-medium text-[#14231e]"
              >
                {meses.map(item => (
                  <option key={`${item.ano}-${item.mes}`} value={`${item.ano}-${item.mes}`}>
                    {montarMesDeChuva([], item.ano, item.mes).rotulo}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void exportarPdf()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#e2e8e4] bg-white px-3 text-xs font-bold text-[#14231e] transition hover:border-blue-600 hover:text-blue-700"
            >
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-5 sm:p-5">
        {[
          { rotulo: 'Total no mês', valor: `${dados.totalMm.toLocaleString('pt-BR')} mm` },
          { rotulo: 'Dias com chuva', valor: String(dados.diasComChuva) },
          { rotulo: 'Dias impraticáveis', valor: String(dados.diasImpraticaveis) },
          { rotulo: 'Horas paradas', valor: dados.horasParadas.toLocaleString('pt-BR') },
          { rotulo: 'Dias sem diário', valor: String(dados.diasSemDiario) },
        ].map(item => (
          <div key={item.rotulo} className="min-w-0 rounded-lg border border-[#e2e8e4] p-3">
            <p className="text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.rotulo}</p>
            <strong className="mt-1 block truncate text-xl font-black tabular-nums text-[#101a22]">{item.valor}</strong>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={`Mapa de chuvas de ${dados.rotulo}`}>
          {DIAS_SEMANA.map((letra, indice) => (
            <span key={`${letra}-${indice}`} className="pb-1 text-center text-[11px] font-bold uppercase text-slate-400" aria-hidden="true">
              {letra}
            </span>
          ))}
          {Array.from({ length: folgaInicial }, (_, indice) => <span key={`folga-${indice}`} aria-hidden="true" />)}
          {dados.dias.map(dia => {
            const faixa = faixaDaChuva(dia.milimetros);
            const cor = CORES_FAIXA[faixa];
            const descricao = dia.milimetros === null
              ? `Dia ${dia.dia}: sem diário lançado`
              : `Dia ${dia.dia}: ${dia.milimetros.toLocaleString('pt-BR')} mm, ${ROTULO_FAIXA[faixa].toLowerCase()}`;
            return (
              <div
                key={dia.data}
                role="gridcell"
                title={descricao}
                aria-label={descricao}
                className="mapa-chuva__dia flex min-h-14 flex-col items-center justify-center rounded-lg border p-1"
                style={{ background: cor.fundo, color: cor.texto, borderColor: cor.borda }}
              >
                <span className="text-[11px] font-bold leading-none opacity-80">{dia.dia}</span>
                <strong className="mt-0.5 text-sm font-black leading-none tabular-nums">
                  {dia.milimetros === null ? '—' : dia.milimetros.toLocaleString('pt-BR')}
                </strong>
                {dia.impraticavel && (
                  <Umbrella className="mt-0.5 h-3 w-3" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {(Object.keys(ROTULO_FAIXA) as FaixaChuva[]).map(faixa => (
            <li key={faixa} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <span
                className="inline-block h-3 w-3 rounded border"
                style={{ background: CORES_FAIXA[faixa].fundo, borderColor: CORES_FAIXA[faixa].borda }}
                aria-hidden="true"
              />
              {ROTULO_FAIXA[faixa]}
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <Umbrella className="h-3 w-3" aria-hidden="true" /> Dia impraticável
          </li>
        </ul>
      </div>
    </section>
  );
}

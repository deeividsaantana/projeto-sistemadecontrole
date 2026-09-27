import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { List, ListOrdered } from 'lucide-react';
import type { Fatia, Pizza } from '../../modules/materials/graficosMateriais';
import { BOTAO_SECUNDARIO, CARTAO, FOCO, reduzMovimento } from '../cadastros/estilos';

const CENTRO = 100;
const RAIO_FORA = 92;
const RAIO_DENTRO = 58;
const DESTAQUE = 6;

const ponto = (raio: number, angulo: number) => {
  const radianos = ((angulo - 90) * Math.PI) / 180;
  return `${(CENTRO + raio * Math.cos(radianos)).toFixed(2)} ${(CENTRO + raio * Math.sin(radianos)).toFixed(2)}`;
};

/** Pedaço da rosca entre dois ângulos (em graus, 0 no alto, sentido horário). */
const arco = (inicio: number, fim: number, fora: number) => {
  // Uma fatia só de 360° some no SVG: fecha em 359,99.
  const final = Math.min(fim, inicio + 359.99);
  const grande = final - inicio > 180 ? 1 : 0;
  return `M ${ponto(fora, inicio)} A ${fora} ${fora} 0 ${grande} 1 ${ponto(fora, final)} L ${ponto(RAIO_DENTRO, final)} A ${RAIO_DENTRO} ${RAIO_DENTRO} 0 ${grande} 0 ${ponto(RAIO_DENTRO, inicio)} Z`;
};

interface Props {
  id: string;
  titulo: string;
  subtitulo: string;
  pizza: Pizza;
  /** Como escrever um valor: "1.234 t", "R$ 5.000,00", "32 viagens". */
  formatar: (valor: number) => string;
  /** Versão curta para o meio da rosca, onde "R$ 1.597.566,70" não cabe. */
  formatarCurto?: (valor: number) => string;
  /** O que ficou de fora, dito em uma linha, ou nada. */
  notaDeFora?: string;
  vazio: string;
  /** Botão da fatia escolhida, por exemplo "Ver movimentos". */
  acao?: { rotulo: (fatia: Fatia) => string; executar: (fatia: Fatia) => void };
}

/**
 * Pizza em rosca com a porcentagem de cada parte. Tocar ou passar o mouse
 * numa fatia ou num nome da legenda mostra o número dela no meio da rosca.
 * A legenda sempre escreve nome, porcentagem e valor: a cor só ajuda.
 */
export default function GraficoPizza({ id, titulo, subtitulo, pizza, formatar, formatarCurto = formatar, notaDeFora, vazio, acao }: Props) {
  const raiz = useRef<HTMLElement>(null);
  // Passar o mouse mostra; tocar fixa (no celular não existe "passar").
  const [sobre, setSobre] = useState<string | null>(null);
  const [fixada, setFixada] = useState<string | null>(null);
  const fatia = pizza.fatias.find(item => item.chave === (sobre ?? fixada)) ?? null;
  // Parte que sumiu ao trocar o mês não deixa a pizza apagada.
  const ativa = fatia?.chave ?? null;
  const [emLista, setEmLista] = useState(false);
  const assinatura = pizza.fatias.map(item => `${item.chave}:${item.valor}`).join('|');

  useGSAP(() => {
    if (reduzMovimento() || !raiz.current) return;
    gsap.fromTo(
      raiz.current.querySelectorAll('[data-fatia]'),
      { opacity: 0, scale: 0.85, svgOrigin: `${CENTRO} ${CENTRO}` },
      { opacity: 1, scale: 1, duration: 0.45, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' },
    );
  }, { scope: raiz, dependencies: [assinatura, emLista] });

  let angulo = 0;
  const pedacos = pizza.total > 0 ? pizza.fatias.map(item => {
    const inicio = angulo;
    angulo += (item.valor / pizza.total) * 360;
    return { item, inicio, fim: angulo };
  }) : [];
  const descricao = pizza.fatias.map(item => `${item.nome}: ${item.percentual}%`).join(', ');
  const alternar = (chave: string) => {
    setSobre(null);
    setFixada(atual => (atual === chave ? null : chave));
  };
  const totalEscrito = formatarCurto(pizza.total);

  return (
    <section ref={raiz} data-materiais-reveal className={`${CARTAO} flex min-w-0 flex-col p-4`} aria-labelledby={id}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-bold text-slate-900">{titulo}</h2>
          <p className="text-sm text-slate-500">{subtitulo}</p>
        </div>
        {pizza.todas.length > 0 && (
          <button
            type="button"
            onClick={() => setEmLista(atual => !atual)}
            aria-pressed={emLista}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}
          >
            {emLista ? <ListOrdered className="size-4" aria-hidden="true" /> : <List className="size-4" aria-hidden="true" />}
            {emLista ? 'Ver pizza' : `Lista (${pizza.todas.length})`}
          </button>
        )}
      </header>

      {pizza.total <= 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-slate-500">{vazio}</p>
      ) : emLista ? (
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{titulo}, todas as partes</caption>
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="p-2 pl-3">Nome</th><th className="p-2 text-right">%</th><th className="p-2 pr-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pizza.todas.map(item => (
                <tr key={item.chave}>
                  <td className="p-2 pl-3 text-slate-800">{item.nome}</td>
                  <td className="p-2 text-right font-bold tabular-nums text-slate-900">{item.percentual < 1 && item.valor > 0 ? '<1' : item.percentual}%</td>
                  <td className="whitespace-nowrap p-2 pr-3 text-right tabular-nums text-slate-600">{formatar(item.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative size-44 shrink-0">
            <svg viewBox="0 0 200 200" className="size-44 overflow-visible" onMouseLeave={() => setSobre(null)} role="img" aria-label={`${titulo}: ${descricao}`}>
              {pedacos.map(({ item, inicio, fim }) => {
                const escolhida = item.chave === ativa;
                return (
                  <path
                    key={item.chave}
                    data-fatia
                    d={arco(inicio, fim, escolhida ? RAIO_FORA + DESTAQUE : RAIO_FORA)}
                    fill={item.cor}
                    stroke="#ffffff"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    opacity={ativa && !escolhida ? 0.45 : 1}
                    className="cursor-pointer transition-opacity duration-200"
                    onMouseEnter={() => setSobre(item.chave)}
                    onClick={() => alternar(item.chave)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-11 text-center" aria-live="polite">
              {fatia ? (
                <div className="min-w-0">
                  <strong className="block text-2xl font-black tabular-nums text-slate-950">{fatia.percentual}%</strong>
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-slate-600">{fatia.nome}</span>
                </div>
              ) : (
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-500">Total</span>
                  <strong className={`block font-black leading-tight tabular-nums text-slate-950 ${totalEscrito.length > 11 ? 'text-xs' : 'text-sm'}`}>{totalEscrito}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="w-full min-w-0 flex-1" onMouseLeave={() => setSobre(null)}>
            <ol className="space-y-0.5">
              {pizza.fatias.map(item => {
                const escolhida = item.chave === ativa;
                return (
                  <li key={item.chave}>
                    <button
                      type="button"
                      aria-pressed={escolhida}
                      onMouseEnter={() => setSobre(item.chave)}
                      onFocus={() => setSobre(item.chave)}
                      onBlur={() => setSobre(null)}
                      onClick={() => alternar(item.chave)}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left transition duration-200 ${escolhida ? 'bg-slate-100' : 'hover:bg-slate-50'} ${FOCO}`}
                    >
                      <span className="size-3.5 shrink-0 rounded-[4px]" style={{ backgroundColor: item.cor }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800" title={item.nome}>{item.nome}</span>
                        <span className="block text-xs tabular-nums text-slate-500">{formatar(item.valor)}</span>
                      </span>
                      <strong className="shrink-0 text-base font-black tabular-nums text-slate-950">{item.percentual < 1 ? '<1' : item.percentual}%</strong>
                    </button>
                  </li>
                );
              })}
            </ol>
            {fatia && acao && fatia.chave !== '__outros' && (
              <button type="button" onClick={() => acao.executar(fatia)} className={`${BOTAO_SECUNDARIO} mt-2 w-full`}>{acao.rotulo(fatia)}</button>
            )}
          </div>
        </div>
      )}

      {notaDeFora && pizza.total > 0 && <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">{notaDeFora}</p>}
    </section>
  );
}

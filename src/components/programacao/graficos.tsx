import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Gráficos leves da Programação, em SVG puro (sem biblioteca): linha com
 * passar o mouse / tocar e rosca com legenda. Desenham na largura real do
 * cartão, para a letra nunca encolher no celular.
 */

const useLargura = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;
    const medir = () => setLargura(elemento.clientWidth);
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, largura] as const;
};

export interface SerieLinha {
  nome: string;
  /** Classe de cor do traço (stroke-*) e do ponto da legenda (bg-*). */
  traco: string;
  ponto: string;
  tracejado?: boolean;
  /** Um valor por rótulo do eixo X; vazio quebra a linha (ex.: dias futuros). */
  valores: ReadonlyArray<number | undefined>;
}

interface LinhaProps {
  titulo: string;
  rotulosX: readonly string[];
  /** Rótulo do dia no tooltip (mais longo que o do eixo). */
  rotulosLongos?: readonly string[];
  series: readonly SerieLinha[];
  formatar: (valor: number) => string;
  maximo?: number;
  /** Índice destacado no eixo (ex.: hoje). */
  marcaX?: number;
  rotuloMarca?: string;
  altura?: number;
}

const passoBonito = (maximo: number) => {
  const bruto = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(Math.max(bruto, 1e-9)));
  const passo = [1, 2, 2.5, 5, 10].map(fator => fator * potencia).find(valor => valor >= bruto) ?? bruto;
  return passo;
};

export function GraficoLinha({ titulo, rotulosX, rotulosLongos = rotulosX, series, formatar, maximo, marcaX, rotuloMarca, altura = 220 }: LinhaProps) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [indice, setIndice] = useState<number | null>(null);
  const total = rotulosX.length;
  const todos = series.flatMap(serie => serie.valores.filter((valor): valor is number => valor !== undefined));
  const topoBruto = maximo ?? Math.max(1, ...todos);
  const passo = passoBonito(topoBruto);
  const topo = maximo ?? Math.ceil(topoBruto / passo) * passo;
  const margem = { esquerda: 44, direita: 12, cima: 12, baixo: 26 };
  const area = { largura: Math.max(0, largura - margem.esquerda - margem.direita), altura: altura - margem.cima - margem.baixo };
  const x = (i: number) => margem.esquerda + (total <= 1 ? area.largura / 2 : (i / (total - 1)) * area.largura);
  const y = (valor: number) => margem.cima + area.altura - (Math.min(valor, topo) / topo) * area.altura;
  const linhasY = Array.from({ length: Math.floor(topo / passo) + 1 }, (_, i) => i * passo);
  const cadaX = Math.max(1, Math.ceil(total / Math.max(2, Math.floor(area.largura / 56))));

  const caminho = (valores: ReadonlyArray<number | undefined>) => {
    let d = '';
    let aberto = false;
    valores.forEach((valor, i) => {
      if (valor === undefined) { aberto = false; return; }
      d += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)} ${y(valor).toFixed(1)} `;
      aberto = true;
    });
    return d.trim();
  };

  const mover = (clienteX: number, alvo: SVGSVGElement) => {
    const caixa = alvo.getBoundingClientRect();
    const relativo = clienteX - caixa.left - margem.esquerda;
    const i = total <= 1 ? 0 : Math.round((relativo / Math.max(1, area.largura)) * (total - 1));
    setIndice(Math.max(0, Math.min(total - 1, i)));
  };

  // A última posição com valor de cada série recebe o nome dela (rótulo direto).
  const ultimos = series.map(serie => {
    for (let i = serie.valores.length - 1; i >= 0; i -= 1) if (serie.valores[i] !== undefined) return { i, valor: serie.valores[i] as number };
    return null;
  });

  return (
    <figure className="grid gap-2">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
        {series.map(serie => (
          <span key={serie.nome} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-0.5 w-5 ${serie.ponto} ${serie.tracejado ? 'opacity-80 [mask:repeating-linear-gradient(90deg,#000_0_4px,transparent_4px_7px)]' : ''}`} aria-hidden="true" />
            {serie.nome}
          </span>
        ))}
      </figcaption>
      <div ref={ref} className="relative w-full">
        {largura > 0 && (
          <svg
            width={largura}
            height={altura}
            role="img"
            aria-label={titulo}
            className="block touch-pan-y select-none"
            onPointerMove={event => mover(event.clientX, event.currentTarget)}
            onPointerDown={event => mover(event.clientX, event.currentTarget)}
            onPointerLeave={() => setIndice(null)}
          >
            {linhasY.map(valor => (
              <g key={valor}>
                <line x1={margem.esquerda} x2={largura - margem.direita} y1={y(valor)} y2={y(valor)} className="stroke-slate-100" strokeWidth={1} />
                <text x={margem.esquerda - 6} y={y(valor)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-xs tabular-nums">{formatar(valor)}</text>
              </g>
            ))}
            {rotulosX.map((rotulo, i) => ((i % cadaX === 0 && x(total - 1) - x(i) >= 64) || i === total - 1) && (
              <text key={`${rotulo}-${i}`} x={x(i)} y={altura - 8} textAnchor={i === total - 1 && total > 1 ? 'end' : i === 0 ? 'start' : 'middle'} className="fill-slate-500 text-xs tabular-nums">{rotulo}</text>
            ))}
            {marcaX !== undefined && marcaX >= 0 && marcaX < total && (
              <g>
                <line x1={x(marcaX)} x2={x(marcaX)} y1={margem.cima} y2={margem.cima + area.altura} className="stroke-slate-300" strokeDasharray="2 3" />
                {rotuloMarca && <text x={x(marcaX)} y={margem.cima} dy="-2" textAnchor="middle" className="fill-slate-600 text-xs font-bold">{rotuloMarca}</text>}
              </g>
            )}
            {series.map(serie => (
              <path key={serie.nome} d={caminho(serie.valores)} fill="none" className={serie.traco} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={serie.tracejado ? '6 4' : undefined} />
            ))}
            {series.map((serie, s) => ultimos[s] && (
              <circle key={`fim-${serie.nome}`} cx={x(ultimos[s]!.i)} cy={y(ultimos[s]!.valor)} r={4} className={`${serie.traco} fill-white`} strokeWidth={2} />
            ))}
            {indice !== null && (
              <g pointerEvents="none">
                <line x1={x(indice)} x2={x(indice)} y1={margem.cima} y2={margem.cima + area.altura} className="stroke-slate-400" strokeWidth={1} />
                {series.map(serie => serie.valores[indice] !== undefined && (
                  <circle key={serie.nome} cx={x(indice)} cy={y(serie.valores[indice] as number)} r={4.5} className={`${serie.traco} fill-white`} strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {indice !== null && largura > 0 && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(0, x(indice) + 10), Math.max(0, largura - 160)) }}
            role="status"
          >
            <p className="font-black text-slate-900">{rotulosLongos[indice]}</p>
            {series.map(serie => (
              <p key={serie.nome} className="flex items-center justify-between gap-3 font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${serie.ponto}`} aria-hidden="true" />{serie.nome}</span>
                <span className="font-black tabular-nums text-slate-900">{serie.valores[indice] === undefined ? '—' : formatar(serie.valores[indice] as number)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

export interface FatiaRosca { chave: string; nome: string; valor: number; cor: string; }

const CENTRO = 80;
const FORA = 74;
const DENTRO = 52;
const ponto = (raio: number, angulo: number) => {
  const r = ((angulo - 90) * Math.PI) / 180;
  return `${(CENTRO + raio * Math.cos(r)).toFixed(2)} ${(CENTRO + raio * Math.sin(r)).toFixed(2)}`;
};
const arco = (inicio: number, fim: number) => {
  const final = Math.min(fim, inicio + 359.99);
  const grande = final - inicio > 180 ? 1 : 0;
  return `M ${ponto(FORA, inicio)} A ${FORA} ${FORA} 0 ${grande} 1 ${ponto(FORA, final)} L ${ponto(DENTRO, final)} A ${DENTRO} ${DENTRO} 0 ${grande} 0 ${ponto(DENTRO, inicio)} Z`;
};

/** Rosca com o número principal no meio e a legenda ao lado (nome, % e valor escritos). */
export function Rosca({ titulo, fatias, centro, legendaValor }: { titulo: string; fatias: readonly FatiaRosca[]; centro: ReactNode; legendaValor: (fatia: FatiaRosca, percentual: number) => string }) {
  const [ativa, setAtiva] = useState<string | null>(null);
  const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
  let angulo = 0;
  const pedacos = fatias.filter(fatia => fatia.valor > 0).map(fatia => {
    const inicio = angulo;
    angulo += total > 0 ? (fatia.valor / total) * 360 : 0;
    return { fatia, inicio, fim: angulo };
  });
  return (
    <figure className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 160 160" className="size-40 shrink-0" role="img" aria-label={`${titulo}: ${fatias.map(fatia => `${fatia.nome} ${total ? Math.round((fatia.valor / total) * 100) : 0}%`).join(', ')}`}>
        {total === 0 && <circle cx={CENTRO} cy={CENTRO} r={(FORA + DENTRO) / 2} fill="none" className="stroke-slate-100" strokeWidth={FORA - DENTRO} />}
        {pedacos.map(({ fatia, inicio, fim }) => (
          <path
            key={fatia.chave}
            d={arco(inicio, fim)}
            className={`${fatia.cor} stroke-white transition-opacity`}
            strokeWidth={2}
            opacity={ativa && ativa !== fatia.chave ? 0.35 : 1}
            onPointerEnter={() => setAtiva(fatia.chave)}
            onPointerLeave={() => setAtiva(null)}
          />
        ))}
        <foreignObject x={DENTRO / 2 + 18} y={CENTRO - 26} width={160 - DENTRO - 36} height={52}>
          <div className="flex h-full flex-col items-center justify-center text-center leading-tight">{centro}</div>
        </foreignObject>
      </svg>
      <ul className="grid min-w-40 gap-1.5 text-sm">
        {fatias.map(fatia => {
          const percentual = total ? Math.round((fatia.valor / total) * 100) : 0;
          return (
            <li
              key={fatia.chave}
              className={`flex items-center justify-between gap-4 rounded-lg px-2 py-1 ${ativa === fatia.chave ? 'bg-slate-50' : ''}`}
              onPointerEnter={() => setAtiva(fatia.chave)}
              onPointerLeave={() => setAtiva(null)}
            >
              <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true"><circle cx="5" cy="5" r="5" className={fatia.cor} /></svg>
                {fatia.nome}
              </span>
              <span className="font-black tabular-nums text-slate-900">{legendaValor(fatia, percentual)}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { CravacaoEstaca } from '../../types';
import { estaCravada, nomeDaEstaca, type FrenteEstacas } from '../../modules/estacas/avancoEstacas';
import { formatarData, numero } from '../../utils/formato';
import { reduzMovimento } from '../cadastros/estilos';
import './Estacas.css';

interface Props {
  frente: FrenteEstacas;
  escolhidaId?: string | null;
  onEscolher: (estaca: CravacaoEstaca) => void;
}

// Unidades do desenho: cada estaca tem PASSO de largura e cada metro, ESCALA.
const PASSO = 26;
const ESCALA = 16;
const MARGEM_ESQUERDA = 46;
const MARGEM_DIREITA = 10;
const FAIXA_PLANTA = 30;
const FAIXA_MARTELO = 34;
const FUNDO_EXTRA = 22;

/** Quanto da estaca ficou acima do chão depois de cravada (a sobra, antes do corte). */
const acimaDoChao = (estaca: CravacaoEstaca) => {
  if (Number(estaca.sobraM) > 0) return Number(estaca.sobraM);
  return Math.max(0, (Number(estaca.comprimentoM) || 0) - (Number(estaca.comprimentoCravadoM) || 0) - (Number(estaca.perdaM) || 0));
};

/** Estacas por linha do desenho, pela largura que a tela tem. */
const useEstacasPorLinha = (total: number) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(960);
  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento || typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(([entrada]) => setLargura(Math.round(entrada.contentRect.width)));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  // No celular cada estaca fica com uns 16 px; no computador, até 30 px.
  const minimo = largura < 640 ? 16 : 22;
  const porLinha = Math.max(8, Math.min(50, Math.floor((largura - 40) / minimo)));
  return { caixa, porLinha: Math.min(porLinha, Math.max(total, 8)) };
};

/**
 * A cortina de estacas vista de frente, como no projeto: o chão no meio, a
 * parte cravada em verde dentro da terra, a sobra acima do chão, as que
 * faltam tracejadas no lugar onde vão entrar e a próxima em laranja com o
 * martelo em cima. Acima de tudo, a planta da cortina com o encaixe em Z.
 */
export default function CortinaEstacas({ frente, escolhidaId, onEscolher }: Props) {
  const { caixa, porLinha } = useEstacasPorLinha(frente.estacas.length);
  const [emFoco, setEmFoco] = useState<{ estaca: CravacaoEstaca; x: number; y: number } | null>(null);
  // O cartão aparece logo acima da estaca, onde quer que ela esteja no desenho.
  const mostrar = (event: SyntheticEvent<SVGGElement>, estaca: CravacaoEstaca) => {
    const base = caixa.current?.getBoundingClientRect();
    const alvo = event.currentTarget.getBoundingClientRect();
    if (!base) return;
    setEmFoco({ estaca, x: alvo.left + alvo.width / 2 - base.left, y: alvo.top - base.top });
  };

  // Profundidade que se espera para as que faltam: a média das já cravadas.
  const profundidadeMedia = useMemo(() => {
    const cravadas = frente.estacas.filter(estaCravada);
    if (!cravadas.length) return 8;
    return cravadas.reduce((soma, item) => soma + Number(item.comprimentoCravadoM || 0), 0) / cravadas.length;
  }, [frente.estacas]);

  const profundidadeDe = (estaca: CravacaoEstaca) => (estaCravada(estaca)
    ? Number(estaca.comprimentoCravadoM)
    : Number(estaca.comprimentoM) > 0 ? Math.min(Number(estaca.comprimentoM), profundidadeMedia) : profundidadeMedia);

  const maiorProfundidade = Math.max(4, ...frente.estacas.map(profundidadeDe));
  const maiorSobra = Math.min(4, Math.max(1.5, ...frente.estacas.filter(estaCravada).map(acimaDoChao)));
  const chao = FAIXA_PLANTA + FAIXA_MARTELO + maiorSobra * ESCALA;
  const altura = chao + maiorProfundidade * ESCALA + FUNDO_EXTRA;

  const linhas = useMemo(() => {
    const grupos: CravacaoEstaca[][] = [];
    for (let inicio = 0; inicio < frente.estacas.length; inicio += porLinha) grupos.push(frente.estacas.slice(inicio, inicio + porLinha));
    return grupos;
  }, [frente.estacas, porLinha]);

  const escopo = useRef<HTMLDivElement>(null);
  // As cravadas descem até a profundidade delas, uma atrás da outra, e o
  // martelo da próxima fica batendo. Nada se mexe com movimento reduzido.
  useGSAP(() => {
    if (!escopo.current || reduzMovimento()) return;
    const descem = gsap.utils.toArray<SVGGElement>('[data-desce]', escopo.current);
    descem.forEach((grupo, indice) => {
      gsap.from(grupo, { y: -Number(grupo.dataset.desce || 0), opacity: 0, duration: 0.55, delay: Math.min(indice * 0.018, 0.9), ease: 'power3.out', clearProps: 'transform,opacity' });
    });
    gsap.to('[data-martelo]', { y: 6, duration: 0.32, repeat: -1, yoyo: true, ease: 'power1.inOut' });
  }, { scope: escopo, dependencies: [frente.frente, porLinha, frente.cravadas] });

  const escolherPeloTeclado = (event: KeyboardEvent, estaca: CravacaoEstaca) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onEscolher(estaca);
  };

  const reguas = Array.from({ length: Math.floor(maiorProfundidade / 2.5) }, (_, indice) => (indice + 1) * 2.5)
    .filter(metro => metro <= maiorProfundidade);

  return (
    <div ref={caixa} className="cortina relative">
      <div ref={escopo} className="space-y-3">
        {linhas.map((linha, indiceLinha) => {
          // Todas as linhas com a mesma largura: a última, mais curta, fica na mesma escala.
          const largura = MARGEM_ESQUERDA + porLinha * PASSO + MARGEM_DIREITA;
          const topoPlanta = FAIXA_PLANTA / 2;
          return (
            <svg
              key={`${frente.frente}-${indiceLinha}`}
              viewBox={`0 0 ${largura} ${altura}`}
              role="group"
              aria-label={`Cortina ${frente.frente}, estacas ${indiceLinha * porLinha + 1} a ${indiceLinha * porLinha + linha.length}`}
            >
              <defs>
                <linearGradient id="cortina-ceu" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" className="cortina-ceu-topo" />
                  <stop offset="1" className="cortina-ceu-base" />
                </linearGradient>
                <linearGradient id="cortina-solo" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" className="cortina-solo-topo" />
                  <stop offset="1" className="cortina-solo-base" />
                </linearGradient>
                <linearGradient id="cortina-aco" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" className="cortina-aco-a" />
                  <stop offset="1" className="cortina-aco-b" />
                </linearGradient>
                <pattern id="cortina-pontos" width="14" height="12" patternUnits="userSpaceOnUse">
                  <circle cx="3" cy="3" r="1.1" className="cortina-pontos-cor" />
                  <circle cx="10" cy="9" r="0.8" className="cortina-pontos-cor" />
                </pattern>
              </defs>

              <rect x="0" y="0" width={largura} height={chao} className="cortina-fundo" rx="10" />

              {/* Planta da cortina: o encaixe em Z de cada estaca, na cor da situação. */}
              {linha.map((estaca, indice) => {
                const x = MARGEM_ESQUERDA + indice * PASSO;
                const [a, b] = indice % 2 === 0 ? [topoPlanta - 6, topoPlanta + 6] : [topoPlanta + 6, topoPlanta - 6];
                const tom = estaCravada(estaca) ? 'cortina-planta-cravada' : estaca.id === frente.proxima?.id ? 'cortina-planta-proxima' : 'cortina-planta-prevista';
                return <path key={`p-${estaca.id}`} d={`M${x} ${a} L${x + PASSO * 0.28} ${a} L${x + PASSO * 0.72} ${b} L${x + PASSO} ${b}`} className={`cortina-planta ${tom}`} />;
              })}
              <text x="4" y={topoPlanta + 4} className="cortina-regua-texto">Planta</text>

              {/* Estacas: primeiro o aço, depois a terra por cima, meio transparente. */}
              {linha.map((estaca, indice) => {
                const x = MARGEM_ESQUERDA + indice * PASSO;
                const cravada = estaCravada(estaca);
                const proxima = estaca.id === frente.proxima?.id;
                const fundo = profundidadeDe(estaca) * ESCALA;
                const acima = cravada ? Math.min(acimaDoChao(estaca), 4) * ESCALA : 0;
                const topo = chao - acima;
                const nome = nomeDaEstaca(estaca);
                const rotulo = cravada
                  ? `${nome}, cravada ${numero(estaca.comprimentoCravadoM, 2)} m em ${formatarData(estaca.data)}`
                  : `${nome}, a cravar${proxima ? ', é a próxima' : ''}`;
                return (
                  <g
                    key={estaca.id}
                    className="cortina-estaca"
                    role="button"
                    tabIndex={0}
                    aria-label={rotulo}
                    aria-pressed={escolhidaId === estaca.id}
                    data-escolhida={escolhidaId === estaca.id}
                    onClick={() => onEscolher(estaca)}
                    onKeyDown={event => escolherPeloTeclado(event, estaca)}
                    onMouseEnter={event => mostrar(event, estaca)}
                    onMouseLeave={() => setEmFoco(null)}
                    onFocus={event => mostrar(event, estaca)}
                    onBlur={() => setEmFoco(null)}
                  >
                    {cravada ? (
                      <g data-desce={fundo + acima}>
                        <rect x={x + 1} y={topo} width={PASSO - 2} height={fundo + acima} className="cortina-cravada-corpo" />
                        {/* Face dobrada do perfil: alterna o lado para parecer a cortina encaixada. */}
                        <rect x={indice % 2 === 0 ? x + PASSO * 0.55 : x + 1} y={topo} width={PASSO * 0.44} height={fundo + acima} className="cortina-cravada-face" />
                        <rect x={x + 3} y={topo} width="2" height={fundo + acima} className="cortina-cravada-brilho" />
                        {acima > 0 && <rect x={x + 1} y={topo} width={PASSO - 2} height={acima} className="cortina-sobra" />}
                        <rect x={x + 1} y={topo} width={PASSO - 2} height={fundo + acima} className="cortina-contorno" />
                      </g>
                    ) : (
                      <g>
                        <rect x={x + 2} y={chao} width={PASSO - 4} height={fundo} rx="2" className={proxima ? 'cortina-proxima-corpo' : 'cortina-prevista-corpo'} />
                        <rect x={x + 2} y={chao} width={PASSO - 4} height={fundo} rx="2" className="cortina-contorno" />
                      </g>
                    )}
                    {proxima && (
                      <g data-martelo>
                        <line x1={x + PASSO / 2} x2={x + PASSO / 2} y1={FAIXA_PLANTA} y2={chao - 20} className="cortina-martelo-cabo" />
                        <rect x={x + 3} y={chao - 22} width={PASSO - 6} height="16" rx="3" className="cortina-martelo" />
                      </g>
                    )}
                    {/* Área de toque inteira da coluna, do martelo ao pé da estaca. */}
                    <rect x={x} y={FAIXA_PLANTA} width={PASSO} height={altura - FAIXA_PLANTA} fill="transparent" />
                  </g>
                );
              })}

              <rect x={MARGEM_ESQUERDA - 6} y={chao} width={largura - MARGEM_ESQUERDA + 6} height={altura - chao} className="cortina-terra" pointerEvents="none" />
              <rect x={MARGEM_ESQUERDA - 6} y={chao} width={largura - MARGEM_ESQUERDA + 6} height={altura - chao} className="cortina-textura" pointerEvents="none" />
              <line x1={MARGEM_ESQUERDA - 6} x2={largura} y1={chao} y2={chao} className="cortina-chao" />

              {/* Régua de profundidade a cada 2,5 m. */}
              <text x="4" y={chao + 4} className="cortina-regua-texto">0 m</text>
              {reguas.map(metro => (
                <g key={metro} pointerEvents="none">
                  <line x1={MARGEM_ESQUERDA - 6} x2={largura} y1={chao + metro * ESCALA} y2={chao + metro * ESCALA} className="cortina-regua" />
                  <text x="4" y={chao + metro * ESCALA + 4} className="cortina-regua-texto">−{numero(metro, 1)} m</text>
                </g>
              ))}
            </svg>
          );
        })}
      </div>

      {emFoco && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl max-sm:hidden"
          style={{ left: `clamp(6.5rem, ${emFoco.x}px, calc(100% - 6.5rem))`, top: `${emFoco.y + 24}px` }}
        >
          <p className="font-bold text-slate-900">{nomeDaEstaca(emFoco.estaca)}</p>
          {estaCravada(emFoco.estaca) ? (
            <p className="mt-1 leading-6 text-slate-600">
              Cravada em {formatarData(emFoco.estaca.data)}
              <br />Profundidade: {numero(emFoco.estaca.comprimentoCravadoM, 2)} m
              <br />Estaca de {numero(emFoco.estaca.comprimentoM, 2)} m · sobra {numero(emFoco.estaca.sobraM, 2)} m
            </p>
          ) : (
            <p className="mt-1 text-slate-600">
              {emFoco.estaca.id === frente.proxima?.id ? 'Próxima a cravar.' : 'Ainda a cravar.'}
              {Number(emFoco.estaca.comprimentoM) > 0 ? ` Estaca de ${numero(emFoco.estaca.comprimentoM, 2)} m.` : ''}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">Toque para ver e lançar.</p>
        </div>
      )}
    </div>
  );
}

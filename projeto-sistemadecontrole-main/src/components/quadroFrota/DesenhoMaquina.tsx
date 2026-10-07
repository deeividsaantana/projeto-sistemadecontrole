/**
 * Desenho de perfil de cada tipo de máquina, para o cartão do quadro quando o
 * equipamento não tem foto. Pintura amarela com degradê e brilho, vidro
 * azulado, rodas e esteiras em grafite com aro claro: dá para bater o olho e
 * saber o que é, sem depender de imagem da internet.
 *
 * As cores vêm das variáveis do Tailwind, com o mesmo tom em oklch se a
 * variável não existir (sem hex solto), e cada desenho tem
 * ids próprios para os degradês não se misturarem entre cartões.
 */
import { useId, type ReactElement } from 'react';
import type { Silhueta } from '../../modules/frota/quadroFrota';

interface Tinta {
  corpo: string;
  sombra: string;
  vidro: string;
  metal: string;
  tanque: string;
}

const ESCURO = 'fill-slate-800';
const ARO = 'fill-slate-300';
const DETALHE = 'fill-slate-700';

const Roda = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} className={ESCURO} />
    <circle cx={x} cy={y} r={r * 0.78} className="fill-slate-700" />
    <circle cx={x} cy={y} r={r * 0.46} className={ARO} />
    <circle cx={x} cy={y} r={r * 0.16} className={DETALHE} />
  </g>
);

const Esteira = ({ x, y, largura }: { x: number; y: number; largura: number }) => (
  <g>
    <rect x={x} y={y} width={largura} height={11} rx={5.5} className={ESCURO} />
    <rect x={x + 2} y={y + 2} width={largura - 4} height={7} rx={3.5} className="fill-slate-600" />
    {Array.from({ length: Math.floor((largura - 6) / 8) }, (_, i) => (
      <circle key={i} cx={x + 7 + i * 8} cy={y + 5.5} r={2.3} className={ARO} />
    ))}
    {Array.from({ length: Math.floor(largura / 4) }, (_, i) => (
      <rect key={`g${i}`} x={x + 2 + i * 4} y={y + 9.6} width={2} height={1.4} className={DETALHE} />
    ))}
  </g>
);

const Cabine = ({ x, y, w, h, t }: { x: number; y: number; w: number; h: number; t: Tinta }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2.5} fill={t.sombra} />
    <rect x={x + 2} y={y + 2} width={w - 4} height={h * 0.56} rx={1.5} fill={t.vidro} />
    <path d={`M${x + 3} ${y + 3} L${x + w * 0.45} ${y + 3} L${x + 3} ${y + h * 0.5} Z`} className="fill-white/50" />
    <rect x={x - 1} y={y - 1.5} width={w + 2} height={2.5} rx={1} className={DETALHE} />
  </g>
);

/** Faixa de brilho em cima da carroceria, para dar volume. */
const Brilho = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <rect x={x} y={y} width={w} height={1.6} rx={0.8} className="fill-white/45" />
);

const Escape = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x} y={y} width={2.4} height={8} rx={1} className={DETALHE} />
    <rect x={x - 0.4} y={y - 1} width={3.2} height={1.6} rx={0.6} className={ESCURO} />
  </g>
);

const Farol = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={1.4} className="fill-amber-100" />;

const DESENHOS: Record<Silhueta, (t: Tinta) => ReactElement> = {
  escavadeira: t => (
    <>
      <Esteira x={12} y={42} largura={48} />
      <rect x={14} y={39} width={44} height={4} rx={1} className={DETALHE} />
      <path d="M16 38 L16 30 Q16 27 19 27 L56 27 Q58 27 58 30 L58 38 Z" fill={t.corpo} />
      <rect x={16} y={34} width={42} height={4} fill={t.sombra} />
      <Brilho x={19} y={28.5} w={36} />
      <Cabine x={34} y={13} w={16} h={15} t={t} />
      <rect x={17} y={29} width={10} height={5} rx={1} className="fill-slate-800/25" />
      <Escape x={22} y={19} />
      <path d="M52 30 L69 9 L75 11 L60 33 Z" fill={t.corpo} />
      <path d="M69 9 L86 20 L83 25 L70 16 Z" fill={t.sombra} />
      <rect x={60} y={17} width={10} height={2} rx={1} transform="rotate(-52 65 18)" fill={t.metal} />
      <path d="M82 23 L91 33 L89 37 L79 38 L77 31 Z" className={ESCURO} />
      <path d="M79 38 L81 40 M83 38 L85 40 M87 37 L89 39" className="stroke-slate-800" strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  retro: t => (
    <>
      <Roda x={24} y={44} r={9.5} />
      <Roda x={63} y={46} r={7.5} />
      <path d="M14 42 L14 32 Q14 29 17 29 L66 29 Q69 29 69 32 L69 42 Z" fill={t.corpo} />
      <rect x={14} y={38} width={55} height={4} fill={t.sombra} />
      <Brilho x={17} y={30.5} w={48} />
      <Cabine x={33} y={12} w={19} h={18} t={t} />
      <Escape x={58} y={20} />
      <Farol x={67} y={33} />
      <path d="M69 34 L82 36 L86 46 L73 45 Z" className={ESCURO} />
      <path d="M14 33 L5 19 L9 15 L19 29 Z" fill={t.corpo} />
      <path d="M5 19 L1 31 L7 34 L10 23 Z" className={ESCURO} />
    </>
  ),
  rolo: t => (
    <>
      <circle cx={70} cy={40} r={13.5} className={ESCURO} />
      <circle cx={70} cy={40} r={10.5} fill={t.metal} />
      <circle cx={70} cy={40} r={4} className={DETALHE} />
      <path d="M58 26 L78 23 L84 28 L62 37 Z" fill={t.sombra} />
      <Roda x={24} y={44} r={9.5} />
      <path d="M12 41 L12 30 Q12 27 15 27 L58 27 Q61 27 61 30 L61 41 Z" fill={t.corpo} />
      <rect x={12} y={37} width={49} height={4} fill={t.sombra} />
      <Brilho x={15} y={28.5} w={42} />
      <Cabine x={22} y={10} w={19} h={18} t={t} />
      <Escape x={48} y={18} />
    </>
  ),
  trator: t => (
    <>
      <Esteira x={14} y={42} largura={56} />
      <path d="M18 42 L18 30 Q18 26 22 26 L64 26 Q67 26 67 30 L67 42 Z" fill={t.corpo} />
      <rect x={18} y={38} width={49} height={4} fill={t.sombra} />
      <Brilho x={21} y={27.5} w={42} />
      <rect x={46} y={29} width={16} height={6} rx={1} className="fill-slate-800/25" />
      <Cabine x={22} y={10} w={19} h={17} t={t} />
      <Escape x={52} y={16} />
      <path d="M71 18 L80 18 Q83 34 80 51 L71 51 Z" className={ESCURO} />
      <path d="M72 20 L78 20 Q80 34 78 49 L72 49 Z" fill={t.metal} />
      <rect x={66} y={34} width={6} height={4} fill={t.corpo} />
      <path d="M14 44 L6 49 L10 52 L16 48 Z" className={DETALHE} />
    </>
  ),
  motoniveladora: t => (
    <>
      <Roda x={15} y={46} r={6.5} />
      <Roda x={28} y={46} r={6.5} />
      <Roda x={83} y={46} r={6.5} />
      <path d="M8 41 L8 32 Q8 30 10 30 L37 30 L37 41 Z" fill={t.corpo} />
      <rect x={8} y={38} width={29} height={3} fill={t.sombra} />
      <path d="M35 28 L86 28 Q88 28 88 31 L88 35 L35 35 Z" fill={t.corpo} />
      <Brilho x={38} y={29} w={46} />
      <Cabine x={22} y={13} w={15} h={18} t={t} />
      <Escape x={12} y={22} />
      <path d="M43 40 L66 40 L68 47 L41 47 Z" fill={t.metal} />
      <path d="M41 47 L68 47" className="stroke-slate-800" strokeWidth={1.4} />
      <rect x={52} y={35} width={3} height={5} className={DETALHE} />
    </>
  ),
  carregadeira: t => (
    <>
      <Roda x={25} y={43} r={11} />
      <Roda x={60} y={43} r={11} />
      <path d="M13 38 L13 28 Q13 25 16 25 L65 25 Q68 25 68 28 L68 38 Z" fill={t.corpo} />
      <rect x={13} y={34} width={55} height={4} fill={t.sombra} />
      <Brilho x={16} y={26.5} w={48} />
      <Cabine x={34} y={8} w={19} h={18} t={t} />
      <Escape x={20} y={15} />
      <Farol x={66} y={29} />
      <path d="M66 28 L78 32 L78 38 L68 37 Z" fill={t.sombra} />
      <path d="M75 21 Q91 22 91 31 L89 47 L75 45 Z" className={ESCURO} />
      <path d="M77 23 Q88 24 88 31 L87 44 L77 43 Z" fill={t.metal} />
    </>
  ),
  agricola: t => (
    <>
      <Roda x={27} y={39} r={15} />
      <Roda x={72} y={46} r={8.5} />
      <path d="M36 38 L36 30 Q36 27 39 27 L79 27 Q82 27 82 30 L82 38 Z" fill={t.corpo} />
      <rect x={36} y={35} width={46} height={3} fill={t.sombra} />
      <Brilho x={39} y={28.5} w={40} />
      <Cabine x={20} y={6} w={22} h={22} t={t} />
      <Escape x={64} y={18} />
      <Farol x={80} y={31} />
      <path d="M14 30 Q27 21 40 30" className="fill-none stroke-slate-800" strokeWidth={2.4} />
    </>
  ),
  caminhao: t => (
    <>
      <Roda x={22} y={46} r={7.5} />
      <Roda x={58} y={46} r={7.5} />
      <Roda x={75} y={46} r={7.5} />
      <rect x={32} y={39} width={56} height={3} className={DETALHE} />
      <path d="M36 18 L88 18 L85 39 L36 39 Z" fill={t.corpo} />
      <path d="M36 32 L86.4 32 L85 39 L36 39 Z" fill={t.sombra} />
      <Brilho x={38} y={19.5} w={46} />
      <path d="M44 22 L44 36 M56 22 L56 36 M68 22 L68 36 M80 22 L80 36" className="stroke-slate-800/15" strokeWidth={1.6} />
      <path d="M9 42 L9 27 Q9 21 15 21 L31 21 Q34 21 34 24 L34 42 Z" fill={t.sombra} />
      <path d="M12 24 L25 24 L25 33 L12 33 Z" fill={t.vidro} />
      <path d="M13 25 L19 25 L13 31 Z" className="fill-white/50" />
      <Farol x={10} y={38} />
      <Escape x={30} y={12} />
    </>
  ),
  cavalo: t => (
    <>
      <Roda x={24} y={46} r={7.5} />
      <Roda x={62} y={46} r={7.5} />
      <Roda x={78} y={46} r={7.5} />
      <rect x={30} y={39} width={56} height={3} className={DETALHE} />
      <rect x={56} y={34} width={28} height={5} rx={1.5} className={ESCURO} />
      <ellipse cx={70} cy={33.5} rx={9} ry={2.2} className={ARO} />
      <path d="M40 42 L40 30 L56 30 L56 42 Z" fill={t.sombra} />
      <path d="M9 42 L9 17 Q9 10 16 10 L36 10 Q42 10 42 16 L42 42 Z" fill={t.corpo} />
      <path d="M9 34 L42 34 L42 42 L9 42 Z" fill={t.sombra} />
      <Brilho x={12} y={11.5} w={26} />
      <path d="M12 15 L28 15 L28 26 L12 26 Z" fill={t.vidro} />
      <path d="M13 16 L20 16 L13 23 Z" className="fill-white/50" />
      <rect x={31} y={16} width={7} height={10} rx={1.5} className="fill-slate-800/15" />
      <Farol x={10} y={38} />
      <Escape x={44} y={6} />
    </>
  ),
  pipa: t => (
    <>
      <Roda x={22} y={46} r={7.5} />
      <Roda x={58} y={46} r={7.5} />
      <Roda x={75} y={46} r={7.5} />
      <rect x={32} y={39} width={56} height={3} className={DETALHE} />
      <rect x={36} y={18} width={52} height={21} rx={10.5} fill={t.tanque} />
      <rect x={36} y={30} width={52} height={9} rx={4.5} className="fill-slate-400/40" />
      <rect x={40} y={20} width={44} height={2} rx={1} className="fill-white/60" />
      <rect x={52} y={18} width={2} height={21} className="fill-slate-400/50" />
      <rect x={70} y={18} width={2} height={21} className="fill-slate-400/50" />
      <path d="M9 42 L9 27 Q9 21 15 21 L31 21 Q34 21 34 24 L34 42 Z" fill={t.corpo} />
      <path d="M12 24 L25 24 L25 33 L12 33 Z" fill={t.vidro} />
      <path d="M13 25 L19 25 L13 31 Z" className="fill-white/50" />
      <Farol x={10} y={38} />
      <path d="M86 40 L91 44" className="stroke-sky-500" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  implemento: t => (
    <>
      <path d="M6 30 L30 30 L34 34 L6 34 Z" className={DETALHE} />
      <rect x={28} y={24} width={58} height={9} rx={2.5} fill={t.corpo} />
      <rect x={28} y={29.5} width={58} height={3.5} fill={t.sombra} />
      <Brilho x={30} y={25.5} w={54} />
      {[38, 50, 62, 74].map(x => (
        <g key={x}>
          <circle cx={x} cy={42} r={7} className={ESCURO} />
          <circle cx={x} cy={42} r={4.5} fill={t.metal} />
        </g>
      ))}
    </>
  ),
  guindaste: t => (
    <>
      <Roda x={20} y={47} r={6.5} />
      <Roda x={36} y={47} r={6.5} />
      <Roda x={70} y={47} r={7.5} />
      <Roda x={84} y={47} r={7.5} />
      <rect x={12} y={40} width={80} height={3} className={DETALHE} />
      <path d="M8 40 L8 21 Q8 17 12 17 L27 17 Q31 17 31 21 L31 40 Z" fill={t.corpo} />
      <path d="M11 23 L24 23 L24 31 L11 31 Z" fill={t.vidro} />
      <path d="M12 24 L18 24 L12 30 Z" className="fill-white/50" />
      <Farol x={9} y={36} />
      <rect x={31} y={31} width={56} height={9} rx={1.5} fill={t.sombra} />
      <rect x={31} y={31} width={56} height={2.5} className="fill-slate-800/20" />
      <rect x={31} y={33} width={9} height={8} rx={1} className={ESCURO} />
      <path d="M42 32 L85 6 L89 8.4 L46 34.4 Z" fill={t.metal} />
      <path d="M46 11 L46 32.6 M55 9 L55 34 M64 7 L64 35.4 M73 5 L73 36.8" className="stroke-slate-800/30" strokeWidth={1} />
      <path d="M85 6 L87 2" className="stroke-slate-800" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M87 2 L87 19" className="stroke-slate-800" strokeWidth={1} strokeDasharray="2 2" />
      <rect x={84.5} y={19} width={5} height={4} rx={1} className={ESCURO} />
    </>
  ),
  gerador: t => (
    <>
      <rect x={14} y={44} width={70} height={3} rx={1} className={DETALHE} />
      <rect x={10} y={22} width={78} height={23} rx={3} fill={t.corpo} />
      <rect x={10} y={38} width={78} height={7} rx={2} fill={t.sombra} />
      <Brilho x={13} y={23.5} w={72} />
      <rect x={16} y={26} width={22} height={13} rx={2} className="fill-slate-800/25" />
      <path d="M20 29 L20 36 M25 29 L25 36 M30 29 L30 36 M35 29 L35 36" className="stroke-slate-700/60" strokeWidth={1.6} />
      <rect x={44} y={27} width={30} height={11} rx={1.5} fill={t.metal} />
      <circle cx={51} cy={32.5} r={2.6} className={DETALHE} />
      <circle cx={60} cy={32.5} r={2.6} className={DETALHE} />
      <rect x={67} y={30} width={5} height={5} rx={0.8} className="fill-amber-300" />
      <rect x={78} y={14} width={4} height={10} rx={1.4} className={ESCURO} />
      <rect x={77.2} y={11.5} width={5.6} height={3} rx={1.2} className="fill-slate-700" />
      <rect x={12} y={20} width={10} height={3} rx={1} className={ARO} />
    </>
  ),
  veiculo: t => (
    <>
      <Roda x={25} y={44} r={7.5} />
      <Roda x={71} y={44} r={7.5} />
      <path d="M10 40 L12 29 Q13 27 16 26.5 L30 25 L40 15 Q41 14 43 14 L62 14 Q64 14 65 16 L69 25 L84 27 Q88 28 88 32 L88 40 Z" fill={t.tanque} />
      <path d="M10 36 L88 36 L88 40 L10 40 Z" className="fill-slate-400/50" />
      <path d="M43 17 L61 17 L65 25 L35 25 Z" fill={t.vidro} />
      <path d="M44 18 L51 18 L44 24 Z" className="fill-white/60" />
      <rect x={50} y={17} width={1.6} height={8} className="fill-slate-400/60" />
      <Farol x={86} y={31} />
      <rect x={10} y={30} width={3} height={2} rx={0.8} className="fill-rose-400" />
    </>
  ),
  outro: t => (
    <>
      <Roda x={28} y={44} r={8.5} />
      <Roda x={66} y={44} r={8.5} />
      <path d="M14 40 L14 27 Q14 23 18 23 L74 23 Q78 23 78 27 L78 40 Z" fill={t.corpo} />
      <rect x={14} y={35} width={64} height={5} fill={t.sombra} />
      <Brilho x={17} y={24.5} w={58} />
      <Cabine x={24} y={7} w={19} h={17} t={t} />
      <Escape x={66} y={14} />
    </>
  ),
};

export function DesenhoMaquina({ tipo, className }: { tipo: Silhueta; className?: string }) {
  const id = useId().replace(/:/g, '');
  const tinta: Tinta = {
    corpo: `url(#${id}c)`,
    sombra: `url(#${id}s)`,
    vidro: `url(#${id}v)`,
    metal: `url(#${id}m)`,
    tanque: `url(#${id}t)`,
  };
  const Desenho = DESENHOS[tipo];
  return (
    <svg viewBox="0 0 96 56" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-amber-300, oklch(87.9% 0.169 91.605))' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-amber-500, oklch(76.9% 0.188 70.08))' }} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-amber-500, oklch(76.9% 0.188 70.08))' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-amber-600, oklch(66.6% 0.179 58.318))' }} />
        </linearGradient>
        <linearGradient id={`${id}v`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-sky-100, oklch(95.1% 0.026 236.824))' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-sky-300, oklch(82.8% 0.111 230.318))' }} />
        </linearGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-slate-300, oklch(86.9% 0.022 252.894))' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-slate-500, oklch(55.4% 0.046 257.417))' }} />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-slate-100, oklch(96.8% 0.007 247.896))' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-slate-300, oklch(86.9% 0.022 252.894))' }} />
        </linearGradient>
      </defs>
      <ellipse cx={48} cy={54} rx={42} ry={2.2} className="fill-slate-900/10" />
      {Desenho(tinta)}
    </svg>
  );
}

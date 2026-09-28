/**
 * Desenho de perfil de cada tipo de máquina, para o cartão do quadro quando o
 * equipamento não tem foto. Corpo em âmbar, rodas e esteiras em grafite: dá
 * para bater o olho e saber o que é, sem depender de imagem da internet.
 */
import type { ReactElement } from 'react';
import type { Silhueta } from '../../modules/frota/quadroFrota';

const CORPO = 'fill-amber-400';
const SOMBRA = 'fill-amber-500';
const ESCURO = 'fill-slate-700';
const VIDRO = 'fill-sky-100';
const ARO = 'fill-slate-300';

const Roda = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} className={ESCURO} />
    <circle cx={x} cy={y} r={r * 0.45} className={ARO} />
  </g>
);

const Esteira = ({ x, y, largura }: { x: number; y: number; largura: number }) => (
  <g>
    <rect x={x} y={y} width={largura} height={10} rx={5} className={ESCURO} />
    {Array.from({ length: Math.floor(largura / 9) }, (_, i) => (
      <circle key={i} cx={x + 6 + i * 9} cy={y + 5} r={2.2} className={ARO} />
    ))}
  </g>
);

const Cabine = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2} className={SOMBRA} />
    <rect x={x + 2} y={y + 2} width={w - 4} height={h * 0.55} rx={1.5} className={VIDRO} />
  </g>
);

const DESENHOS: Record<Silhueta, () => ReactElement> = {
  escavadeira: () => (
    <>
      <Esteira x={14} y={42} largura={46} />
      <rect x={18} y={34} width={40} height={9} rx={2} className={CORPO} />
      <Cabine x={20} y={20} w={14} h={15} />
      <path d="M56 36 L70 12 L76 14 L64 38 Z" className={CORPO} />
      <path d="M70 12 L86 22 L83 26 L70 18 Z" className={CORPO} />
      <path d="M82 24 L90 34 L80 38 L78 30 Z" className={ESCURO} />
    </>
  ),
  retro: () => (
    <>
      <Roda x={24} y={44} r={9} />
      <Roda x={62} y={46} r={7} />
      <rect x={16} y={30} width={52} height={12} rx={3} className={CORPO} />
      <Cabine x={34} y={14} w={18} h={17} />
      <path d="M68 34 L84 38 L86 46 L72 44 Z" className={ESCURO} />
      <path d="M16 32 L6 18 L10 14 L20 28 Z" className={CORPO} />
      <path d="M6 18 L2 30 L8 32 L10 22 Z" className={ESCURO} />
    </>
  ),
  rolo: () => (
    <>
      <circle cx={70} cy={40} r={13} className={ESCURO} />
      <circle cx={70} cy={40} r={9} className={SOMBRA} />
      <Roda x={24} y={44} r={9} />
      <rect x={14} y={28} width={46} height={12} rx={3} className={CORPO} />
      <path d="M58 30 L74 26 L80 30 L60 38 Z" className={CORPO} />
      <Cabine x={24} y={12} w={18} h={17} />
    </>
  ),
  trator: () => (
    <>
      <Esteira x={16} y={42} largura={54} />
      <rect x={20} y={28} width={46} height={15} rx={3} className={CORPO} />
      <Cabine x={24} y={12} w={18} h={17} />
      <path d="M72 22 L80 22 L82 50 L72 50 Z" className={ESCURO} />
      <path d="M66 34 L74 34 L74 38 L66 38 Z" className={CORPO} />
    </>
  ),
  motoniveladora: () => (
    <>
      <Roda x={16} y={46} r={6} />
      <Roda x={28} y={46} r={6} />
      <Roda x={82} y={46} r={6} />
      <rect x={10} y={32} width={26} height={9} rx={2} className={CORPO} />
      <rect x={34} y={30} width={50} height={5} rx={2} className={CORPO} />
      <Cabine x={22} y={16} w={14} h={17} />
      <path d="M44 40 L64 40 L66 46 L42 46 Z" className={ESCURO} />
    </>
  ),
  carregadeira: () => (
    <>
      <Roda x={26} y={44} r={10} />
      <Roda x={60} y={44} r={10} />
      <rect x={16} y={28} width={50} height={12} rx={3} className={CORPO} />
      <Cabine x={34} y={12} w={18} h={17} />
      <path d="M66 30 L78 34 L78 40 L68 38 Z" className={CORPO} />
      <path d="M76 24 L90 30 L88 46 L76 44 Z" className={ESCURO} />
    </>
  ),
  agricola: () => (
    <>
      <Roda x={28} y={40} r={14} />
      <Roda x={70} y={46} r={8} />
      <rect x={36} y={30} width={40} height={10} rx={3} className={CORPO} />
      <Cabine x={24} y={10} w={20} h={20} />
      <rect x={64} y={24} width={3} height={7} className={ESCURO} />
    </>
  ),
  caminhao: () => (
    <>
      <Roda x={22} y={46} r={7} />
      <Roda x={58} y={46} r={7} />
      <Roda x={74} y={46} r={7} />
      <path d="M36 20 L86 20 L82 40 L36 40 Z" className={CORPO} />
      <rect x={10} y={22} width={24} height={20} rx={3} className={SOMBRA} />
      <rect x={13} y={25} width={12} height={8} rx={1.5} className={VIDRO} />
    </>
  ),
  pipa: () => (
    <>
      <Roda x={22} y={46} r={7} />
      <Roda x={58} y={46} r={7} />
      <Roda x={74} y={46} r={7} />
      <rect x={36} y={20} width={50} height={20} rx={10} className="fill-slate-200" />
      <rect x={36} y={28} width={50} height={3} className={ARO} />
      <rect x={10} y={22} width={24} height={20} rx={3} className={CORPO} />
      <rect x={13} y={25} width={12} height={8} rx={1.5} className={VIDRO} />
    </>
  ),
  implemento: () => (
    <>
      <path d="M10 30 L30 30 L34 34 L10 34 Z" className={ESCURO} />
      <rect x={30} y={26} width={54} height={8} rx={2} className={CORPO} />
      {[38, 50, 62, 74].map(x => <circle key={x} cx={x} cy={42} r={6} className={ESCURO} />)}
    </>
  ),
  veiculo: () => (
    <>
      <Roda x={26} y={44} r={7} />
      <Roda x={70} y={44} r={7} />
      <path d="M12 38 L14 28 L30 26 L40 16 L62 16 L68 26 L86 28 L86 40 L12 40 Z" className="fill-slate-200" />
      <path d="M42 19 L60 19 L64 26 L36 26 Z" className={VIDRO} />
    </>
  ),
  outro: () => (
    <>
      <Roda x={28} y={44} r={8} />
      <Roda x={66} y={44} r={8} />
      <rect x={16} y={24} width={62} height={16} rx={4} className={CORPO} />
      <Cabine x={24} y={10} w={18} h={15} />
    </>
  ),
};

export function DesenhoMaquina({ tipo, className }: { tipo: Silhueta; className?: string }) {
  const Desenho = DESENHOS[tipo];
  return (
    <svg viewBox="0 0 96 56" className={className} aria-hidden="true" focusable="false">
      <ellipse cx={48} cy={54} rx={40} ry={2} className="fill-slate-200" />
      <Desenho />
    </svg>
  );
}

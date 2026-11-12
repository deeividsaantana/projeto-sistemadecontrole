import { corPeloNome, iniciaisDoNome } from '../../utils/avatar';
import { cn } from './styles';

type TamanhoAvatar = 'sm' | 'md' | 'lg' | 'xl';

const TAMANHO: Record<TamanhoAvatar, string> = {
  sm: 'size-7 text-xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-24 text-2xl',
};

interface AvatarProps {
  nome: string;
  foto?: string | null;
  cor?: string | null;
  tamanho?: TamanhoAvatar;
  className?: string;
}

/**
 * A bolinha de uma pessoa, igual em todo o sistema: a foto quando ela tem; sem
 * foto, as iniciais sobre a cor que ela escolheu (ou uma cor fixa tirada do
 * nome). É decorativa: o nome sempre aparece escrito ao lado.
 */
export function Avatar({ nome, foto, cor, tamanho = 'md', className }: AvatarProps) {
  const base = cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white select-none', TAMANHO[tamanho], className);
  if (foto) {
    return <img src={foto} alt="" aria-hidden="true" draggable={false} className={cn(base, 'bg-slate-100 object-cover')} />;
  }
  return (
    <span aria-hidden="true" className={base} style={{ backgroundColor: cor || corPeloNome(nome) }}>
      {iniciaisDoNome(nome)}
    </span>
  );
}

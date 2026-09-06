import { normalizeComparable } from '../../utils/canonicalIdentity';
import { cn } from './styles';

const REGRAS: Array<{ termos: string[]; classe: string }> = [
  { termos: ['em operacao', 'operando', 'ativo', 'concluida', 'concluido', 'aprovada', 'aprovado', 'lida', 'presente', 'em dia'], classe: 'bg-emerald-50 text-emerald-700' },
  { termos: ['manutencao', 'atencao', 'aguardando', 'pendente', 'planejado', 'em analise', 'media', 'nao lida', 'atraso'], classe: 'bg-amber-50 text-amber-700' },
  { termos: ['a confirmar', 'em andamento', 'em execucao', 'enviada', 'em correcao', 'verificacao', 'baixa'], classe: 'bg-sky-50 text-sky-700' },
  { termos: ['reprovada', 'cancelado', 'cancelada', 'inativo', 'ausente', 'alta', 'vencido', 'critico', 'erro', 'parado'], classe: 'bg-rose-50 text-rose-700' },
];

/**
 * Badge de estado no padrão da referência: fundo pastel, texto na cor do estado,
 * raio pequeno e fonte compacta. A cor vem do próprio texto do status, então uma
 * situação nova não precisa de mapeamento manual em cada tela.
 */
export function StatusBadge({ children, className }: { children: string; className?: string }) {
  const valor = normalizeComparable(children || '');
  const regra = REGRAS.find(item => item.termos.some(termo => valor.includes(termo)));
  return (
    <span className={cn(
      'inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold leading-none',
      regra?.classe || 'bg-slate-100 text-slate-600',
      className,
    )}>
      {children}
    </span>
  );
}

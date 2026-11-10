import { CountUp } from '../../shared/ui/CountUp';
import { cn } from '../../shared/ui/styles';
import { CartaoIndicador, type TomIndicador } from '../../shared/ui/CartaoIndicador';

export type TomDoNumero = 'neutro' | 'ok' | 'alerta' | 'perigo';

export interface NumeroDoResumo {
  rotulo: string;
  valor: number | string;
  /** Frase curta embaixo do número: "de 20 vias", "2 faltando". */
  detalhe?: string;
  tom?: TomDoNumero;
}

const TOM: Record<TomDoNumero, TomIndicador> = {
  neutro: 'neutro',
  ok: 'verde',
  alerta: 'laranja',
  perigo: 'vermelho',
};

/** Faixa de números do resumo: o mesmo CartaoIndicador do Painel, seis por linha no computador. */
export function Numeros({ itens, rotulo, className }: { itens: readonly NumeroDoResumo[]; rotulo: string; className?: string }) {
  return (
    <section aria-label={rotulo} className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6', className)}>
      {itens.map(item => (
        <CartaoIndicador
          key={item.rotulo}
          rotulo={item.rotulo}
          valor={typeof item.valor === 'number' ? <CountUp value={item.valor} /> : item.valor}
          detalhe={item.detalhe}
          // Zero não é "bom" nem "ruim": fica neutro, para o verde não enganar.
          tom={item.valor === 0 ? 'neutro' : TOM[item.tom ?? 'neutro']}
          dados={{ 'data-jazida-bloco': '' }}
        />
      ))}
    </section>
  );
}

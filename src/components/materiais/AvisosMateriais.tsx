import { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, OctagonAlert, type LucideIcon } from 'lucide-react';
import type { AvisoMaterial, GravidadeAviso } from '../../modules/materials/avisosMateriais';
import { CARTAO, FOCO } from '../cadastros/estilos';

const VISUAL: Record<GravidadeAviso, { Icone: LucideIcon; rotulo: string; icone: string; faixa: string }> = {
  critico: { Icone: OctagonAlert, rotulo: 'Urgente', icone: 'text-rose-600', faixa: 'bg-rose-600' },
  atencao: { Icone: AlertTriangle, rotulo: 'Atenção', icone: 'text-amber-600', faixa: 'bg-amber-500' },
  info: { Icone: Clock, rotulo: 'Para conferir', icone: 'text-slate-500', faixa: 'bg-slate-400' },
};
const INICIAIS = 5;

interface Props {
  avisos: readonly AvisoMaterial[];
  onVerMovimentos: (busca: string) => void;
}

/**
 * O que pede ação vem primeiro, do mais grave para o mais leve. Cada aviso
 * diz o porquê em uma frase e leva direto aos movimentos daquele material.
 */
export default function AvisosMateriais({ avisos, onVerMovimentos }: Props) {
  const [todos, setTodos] = useState(false);
  const urgentes = avisos.filter(aviso => aviso.gravidade === 'critico').length;
  const visiveis = todos ? avisos : avisos.slice(0, INICIAIS);

  if (avisos.length === 0) {
    return (
      <p data-materiais-reveal className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" data-testid="materiais-sem-avisos">
        <CheckCircle2 className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />
        Nada pedindo atenção agora: nenhum saldo negativo, nada acabando e nenhum lançamento repetido.
      </p>
    );
  }

  return (
    <section data-materiais-reveal aria-labelledby="materiais-avisos" className={`${CARTAO} overflow-hidden`} data-testid="materiais-avisos">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 id="materiais-avisos" className="text-base font-bold text-slate-900">O que precisa de atenção</h2>
        <p className="text-sm text-slate-600">
          {avisos.length.toLocaleString('pt-BR')} aviso(s){urgentes ? `, ${urgentes} urgente(s)` : ''}
        </p>
      </header>
      <ul className="divide-y divide-slate-100">
        {visiveis.map(aviso => {
          const { Icone, rotulo, icone, faixa } = VISUAL[aviso.gravidade];
          return (
            <li key={aviso.id} className="relative flex flex-col gap-2 py-3 pl-5 pr-4 sm:flex-row sm:items-center sm:gap-4">
              <span className={`absolute inset-y-2 left-0 w-1 rounded-r ${faixa}`} aria-hidden="true" />
              <Icone className={`hidden size-5 shrink-0 sm:block ${icone}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  <span className="sr-only">{rotulo}: </span>
                  {aviso.titulo}
                </p>
                <p className="text-sm text-slate-600">{aviso.detalhe}</p>
              </div>
              {aviso.busca && (
                <button
                  type="button"
                  onClick={() => onVerMovimentos(aviso.busca ?? '')}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1 self-start rounded-xl px-3 text-sm font-bold text-[#176b4d] transition duration-200 hover:bg-emerald-50 sm:self-center ${FOCO}`}
                >
                  Ver movimentos
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {avisos.length > INICIAIS && (
        <button type="button" onClick={() => setTodos(atual => !atual)} aria-expanded={todos} className={`min-h-11 w-full border-t border-slate-100 text-sm font-bold text-[#176b4d] transition duration-200 hover:bg-emerald-50 ${FOCO}`}>
          {todos ? 'Mostrar menos' : `Ver todos os ${avisos.length.toLocaleString('pt-BR')} avisos`}
        </button>
      )}
    </section>
  );
}

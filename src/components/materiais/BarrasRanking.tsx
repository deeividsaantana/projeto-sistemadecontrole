import type { LinhaRanking } from '../../modules/materials/avisosMateriais';
import { CARTAO, FOCO } from '../cadastros/estilos';

interface Props {
  id: string;
  titulo: string;
  subtitulo: string;
  linhas: readonly LinhaRanking[];
  vazio: string;
  /** Tocar numa linha filtra o período por ela. */
  onEscolher?: (nome: string) => void;
  escolhido?: string;
}

/**
 * Ranking em barras deitadas: o nome inteiro cabe à esquerda, o número fica
 * escrito ao lado da barra e a barra só ajuda o olho a comparar.
 */
export default function BarrasRanking({ id, titulo, subtitulo, linhas, vazio, onEscolher, escolhido }: Props) {
  const maior = Math.max(1, ...linhas.map(linha => linha.lancamentos));
  return (
    <section data-materiais-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby={id}>
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 id={id} className="text-base font-bold text-slate-900">{titulo}</h2>
        <p className="text-sm text-slate-500">{subtitulo}</p>
      </header>
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">{vazio}</p>
      ) : (
        <ol className="space-y-1 p-2">
          {linhas.map(linha => {
            const ativo = escolhido === linha.nome;
            const conteudo = (
              <>
                <span className="flex items-baseline justify-between gap-3">
                  <strong className="min-w-0 truncate text-sm text-slate-900" title={linha.nome}>{linha.nome}</strong>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{linha.lancamentos.toLocaleString('pt-BR')}</span>
                </span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${(linha.lancamentos / maior) * 100}%` }} />
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">{linha.detalhe}</span>
              </>
            );
            return (
              <li key={linha.nome}>
                {onEscolher ? (
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => onEscolher(ativo ? '' : linha.nome)}
                    className={`block w-full rounded-xl px-3 py-2 text-left transition duration-200 ${ativo ? 'bg-emerald-50 ring-1 ring-[#176b4d]' : 'hover:bg-slate-50'} ${FOCO}`}
                  >
                    {conteudo}
                  </button>
                ) : <div className="px-3 py-2">{conteudo}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

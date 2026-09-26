import { RotateCcw, Trash2 } from 'lucide-react';
import type { ExclusaoRegistro } from '../../cloud/exclusoes';
import { BOTAO_PERIGO_LEVE, BOTAO_SECUNDARIO, CARTAO } from './estilos';

const NOME_DA_TABELA: Record<string, string> = {
  funcionarios: 'Colaborador',
  empresas: 'Empresa',
  equipamentos: 'Equipamento',
  obras: 'Local',
  comboios: 'Comboio',
  combustiveis: 'Combustível',
  lubrificantes: 'Lubrificante',
  etapas: 'Ramo/trecho',
};

const quando = (iso: string) => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? iso
    : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  exclusoes: ExclusaoRegistro[];
  podeRestaurar: boolean;
  restaurandoId: string | null;
  onRestaurar: (exclusao: ExclusaoRegistro) => void;
  onExcluirDeVez: (exclusao: ExclusaoRegistro) => void;
}

/** O que foi excluído, por quem e quando, com restaurar e excluir de vez ao lado de cada um. */
export default function CadastroLixeira({ exclusoes, podeRestaurar, restaurandoId, onRestaurar, onExcluirDeVez }: Props) {
  if (exclusoes.length === 0) {
    return (
      <div className={`${CARTAO} flex flex-col items-center gap-2 px-6 py-12 text-center`} data-testid="cadastro-lixeira">
        <Trash2 className="size-8 text-slate-300" aria-hidden="true" />
        <p className="text-base font-bold text-slate-800">A Lixeira está vazia</p>
        <p className="max-w-sm text-sm text-slate-500">O que for excluído aparece aqui, com quem excluiu e quando.</p>
      </div>
    );
  }
  return (
    <ul className={`${CARTAO} divide-y divide-slate-100`} data-testid="cadastro-lixeira">
      {exclusoes.map(exclusao => (
        <li key={exclusao.id} data-linha-lista className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-bold text-slate-900">{exclusao.rotulo}</p>
            <p className="text-sm text-slate-500">
              {NOME_DA_TABELA[exclusao.tabela] || exclusao.tabela} · excluído por {exclusao.excluidoPor} em {quando(exclusao.excluidoEm)}
            </p>
          </div>
          {podeRestaurar && (
            <div className="flex shrink-0 gap-2 max-sm:[&>button]:flex-1 max-sm:[&>button]:whitespace-nowrap max-sm:[&>button]:px-3 max-sm:[&_svg]:hidden">
              <button type="button" onClick={() => onRestaurar(exclusao)} disabled={restaurandoId === exclusao.id} className={BOTAO_SECUNDARIO}>
                <RotateCcw className="size-5" aria-hidden="true" />
                {restaurandoId === exclusao.id ? 'Restaurando…' : 'Restaurar'}
              </button>
              <button type="button" onClick={() => onExcluirDeVez(exclusao)} disabled={restaurandoId === exclusao.id} className={BOTAO_PERIGO_LEVE} data-testid="lixeira-excluir-de-vez">
                <Trash2 className="size-5" aria-hidden="true" />
                Excluir de vez
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

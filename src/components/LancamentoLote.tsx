import { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal, Button } from '../shared/ui';
import { useEntradaDeLista } from '../shared/hooks/useEntradaDeLista';

interface LancamentoLoteProps<T> {
  titulo: string;
  descricao: string;
  campos: Array<{
    label: string;
    nome: string;
    tipo: 'texto' | 'numero' | 'data' | 'select';
    opcoes?: string[];
    obrigatorio?: boolean;
  }>;
  onSalvar: (dados: T[]) => void;
  onFechar: () => void;
}

export function LancamentoLote<T extends Record<string, unknown>>({
  titulo,
  descricao,
  campos,
  onSalvar,
  onFechar,
}: LancamentoLoteProps<T>) {
  const [linhas, setLinhas] = useState<T[]>([{} as T]);
  const escopo = useEntradaDeLista([linhas.length]);

  const adicionarLinha = () => {
    setLinhas([...linhas, {} as T]);
  };

  const atualizarLinha = (index: number, campo: string, valor: unknown) => {
    const novasLinhas = [...linhas];
    novasLinhas[index] = { ...novasLinhas[index], [campo]: valor };
    setLinhas(novasLinhas);
  };

  const removerLinha = (index: number) => {
    if (linhas.length <= 1) return;
    const novasLinhas = [...linhas];
    novasLinhas.splice(index, 1);
    setLinhas(novasLinhas);
  };

  const salvar = () => {
    onSalvar(linhas);
    onFechar();
  };

  return (
    <Modal open onClose={onFechar} size="lg" title={titulo} description={descricao}>
      <div ref={escopo} className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold bg-white font-mono">
              {campos.map(campo => (
                <th key={campo.nome} className="py-3.5 px-5">
                  {campo.label}{campo.obrigatorio && '*'}
                </th>
              ))}
              <th className="py-3.5 px-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {linhas.map((linha, index) => (
              <tr key={index} data-linha-lista className="hover:bg-slate-50 transition-colors">
                {campos.map(campo => (
                  <td key={campo.nome} className="py-4 px-5">
                    {campo.tipo === 'texto' && (
                      <input
                        type="text"
                        value={(linha[campo.nome] as string) || ''}
                        onChange={e => atualizarLinha(index, campo.nome, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    )}
                    {campo.tipo === 'numero' && (
                      <input
                        type="number"
                        value={(linha[campo.nome] as number) || ''}
                        onChange={e => atualizarLinha(index, campo.nome, Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    )}
                    {campo.tipo === 'data' && (
                      <input
                        type="date"
                        value={(linha[campo.nome] as string) || ''}
                        onChange={e => atualizarLinha(index, campo.nome, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    )}
                    {campo.tipo === 'select' && campo.opcoes && (
                      <select
                        value={(linha[campo.nome] as string) || ''}
                        onChange={e => atualizarLinha(index, campo.nome, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        {campo.opcoes.map(opcao => (
                          <option key={opcao} value={opcao}>{opcao}</option>
                        ))}
                      </select>
                    )}
                  </td>
                ))}
                <td className="py-4 px-5 text-right">
                  <button
                    type="button"
                    onClick={() => removerLinha(index)}
                    disabled={linhas.length <= 1}
                    className="p-1.5 bg-white text-slate-700 hover:text-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Remover linha"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={adicionarLinha}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <Plus className="h-4 w-4" /> Adicionar linha
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Salvar {linhas.length} linha{linhas.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
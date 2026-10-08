import { useEffect, useState } from 'react';
import { AlertCircle, FileSpreadsheet, Upload, X } from 'lucide-react';
import type { Abastecimento, TipoCombustivel } from '../types';
import type { FuelImportPreview } from '../utils/fuelImportXlsx';
import { importarAbastecimentosXlsx } from '../utils/fuelImportXlsx';

interface ImportacaoPlanilhaModalProps {
  isOpen: boolean;
  isLoading: boolean;
  equipamentos: Array<{ id: string; prefixo: string }>;
  combustiveis: TipoCombustivel[];
  comboios: Array<{ id: string; nome: string }>;
  usuarioResponsavel: string;
  onConfirm: (registros: Abastecimento[], combustiveisNovos?: TipoCombustivel[]) => void;
  onCancel: () => void;
}

export function ImportacaoPlanilhaModal({
  isOpen,
  isLoading,
  equipamentos,
  combustiveis,
  comboios,
  usuarioResponsavel,
  onConfirm,
  onCancel,
}: ImportacaoPlanilhaModalProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<FuelImportPreview | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const equipamentosPorPrefixo = new Map(equipamentos.map(e => [e.prefixo.toLowerCase(), e.id]));
  const combustivelPorNome = new Map(combustiveis.map(c => [c.nome.toLowerCase(), c.id]));
  const comboiosPorNome = new Map(comboios.map(c => [c.nome.toLowerCase(), c.id]));

  useEffect(() => {
    if (!isOpen) {
      setArquivo(null);
      setPreview(null);
      setErro('');
    }
  }, [isOpen]);

  const handleArquivoSelecionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    setArquivo(file);
    setErro('');
    setProcessando(true);

    try {
      const preview = await importarAbastecimentosXlsx({
        file,
        equipamentosPorPrefixo,
        combustivelPorNome,
        comboiosPorNome,
        usuarioResponsavel,
      });
      setPreview(preview);

      if (preview.erros.length > 0) {
        setErro(
          `${preview.erros.length} erro(s) encontrado(s). Verifique os detalhes abaixo.`,
        );
      }
    } catch (err) {
      setErro(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleConfirmar = () => {
    if (!preview) return;
    onConfirm(preview.registrosImportados, preview.combustiveisNovos);
    setArquivo(null);
    setPreview(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-blue-600" size={24} />
            <h2 className="text-lg font-bold text-slate-900">Importar Abastecimentos</h2>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4">
          {!preview ? (
            <>
              <p className="text-sm text-slate-600">
                Selecione um arquivo Excel com abas de combustível (ex: OUTUBRO 2026, SETEMBRO 2026).
              </p>

              <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 py-8 cursor-pointer hover:border-blue-500 transition">
                <Upload className="mb-2 text-blue-600" size={32} />
                <span className="font-medium text-blue-900">Selecionar arquivo Excel</span>
                <span className="text-xs text-blue-700">(.xlsx, .xls)</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleArquivoSelecionado}
                  disabled={processando}
                  className="hidden"
                />
              </label>

              {processando && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-slate-600">Processando arquivo...</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-700">{preview.registrosImportados.length}</div>
                  <div className="text-xs text-green-600">Registros</div>
                </div>
                <div className="rounded bg-amber-50 p-3">
                  <div className="text-2xl font-bold text-amber-700">{preview.combustiveisNovos.length}</div>
                  <div className="text-xs text-amber-600">Combustíveis</div>
                </div>
                <div className="rounded bg-orange-50 p-3">
                  <div className="text-2xl font-bold text-orange-700">{preview.avisos.length}</div>
                  <div className="text-xs text-orange-600">Avisos</div>
                </div>
                <div className="rounded bg-red-50 p-3">
                  <div className="text-2xl font-bold text-red-700">{preview.erros.length}</div>
                  <div className="text-xs text-red-600">Erros</div>
                </div>
              </div>

              {/* Erros */}
              {preview.erros.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={18} />
                    <span className="font-medium text-red-900">Erros encontrados:</span>
                  </div>
                  <ul className="space-y-1 text-sm text-red-800">
                    {preview.erros.slice(0, 5).map((e, idx) => (
                      <li key={idx}>
                        <strong>{e.aba}, linha {e.linha}:</strong> {e.erro}
                      </li>
                    ))}
                    {preview.erros.length > 5 && (
                      <li className="text-red-700">... e mais {preview.erros.length - 5} erro(s)</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Avisos */}
              {preview.avisos.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertCircle className="text-amber-600" size={18} />
                    <span className="font-medium text-amber-900">Avisos:</span>
                  </div>
                  <ul className="space-y-1 text-sm text-amber-800">
                    {preview.avisos.slice(0, 5).map((a, idx) => (
                      <li key={idx}>
                        <strong>{a.aba}, linha {a.linha}:</strong> {a.aviso}
                      </li>
                    ))}
                    {preview.avisos.length > 5 && (
                      <li className="text-amber-700">... e mais {preview.avisos.length - 5} aviso(s)</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Combustíveis novos */}
              {preview.combustiveisNovos.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <span className="font-medium text-blue-900">Combustíveis que serão criados:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preview.combustiveisNovos.map(c => (
                      <span
                        key={c.id}
                        className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700"
                      >
                        {c.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipamentos não encontrados */}
              {preview.equipamentosNaoEncontrados.size > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <span className="font-medium text-yellow-900">Prefixos não encontrados no cadastro:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(preview.equipamentosNaoEncontrados).slice(0, 10).map(p => (
                      <span
                        key={p}
                        className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs text-yellow-700"
                      >
                        {p}
                      </span>
                    ))}
                    {preview.equipamentosNaoEncontrados.size > 10 && (
                      <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs text-yellow-700">
                        +{preview.equipamentosNaoEncontrados.size - 10} mais
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {erro && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 flex-shrink-0 text-red-600" size={18} />
                <p className="text-sm text-red-800">{erro}</p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-slate-50 px-6 py-4">
          <button
            onClick={() => {
              setArquivo(null);
              setPreview(null);
              setErro('');
            }}
            disabled={!preview || processando || isLoading}
            className="rounded px-4 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            onClick={onCancel}
            disabled={processando || isLoading}
            className="rounded px-4 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!preview || processando || isLoading || preview.erros.length > 0}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Importando...' : 'Confirmar importação'}
          </button>
        </div>
      </div>
    </div>
  );
}

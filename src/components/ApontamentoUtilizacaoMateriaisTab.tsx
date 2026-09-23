/**
 * Lançamento rápido de material por ramo — pensado pra quem está em campo:
 * escolhe o material, o ramo, quanto entrou ou quanto foi usado hoje, salva.
 * Nada de painel administrativo em volta; quem quiser o relatório completo
 * (recebido/utilizado/saldo/%) acha em Materiais > Utilização por Ramo.
 */
import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';
import type { EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../types';
import { isoDay, PageHeader } from '../shared/ui';

interface ApontamentoUtilizacaoMateriaisTabProps {
  materiais: Material[];
  ramos: EtapaServico[];
  responsavel: string;
  onSaveMovimento: (movimento: MovimentoMaterial) => void;
}

const especificacao = (material: Material) => {
  const partes: string[] = [];
  if (material.diametroMm) partes.push(`Ø${material.diametroMm}mm`);
  if (material.comprimentoM) partes.push(`${material.comprimentoM.toLocaleString('pt-BR')}m`);
  return partes.join(' · ');
};

export default function ApontamentoUtilizacaoMateriaisTab({
  materiais,
  ramos,
  responsavel,
  onSaveMovimento,
}: ApontamentoUtilizacaoMateriaisTabProps) {
  const hoje = isoDay(new Date());
  const materiaisAtivos = useMemo(() => materiais.filter(item => item.ativo !== false), [materiais]);

  const [tipo, setTipo] = useState<TipoMovimentoMaterial>('Saída');
  const [materialId, setMaterialId] = useState('');
  const [ramoId, setRamoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState('');
  const [confirmado, setConfirmado] = useState<string | null>(null);

  const materialSelecionado = materiaisAtivos.find(item => item.id === materialId);

  const limpar = () => {
    setMaterialId('');
    setRamoId('');
    setQuantidade('');
  };

  const salvar = () => {
    setErro('');
    if (!materialSelecionado) { setErro('Escolha o material.'); return; }
    if (!ramoId) { setErro('Escolha o ramo/trecho.'); return; }
    const quantidadeNumero = Number(quantidade.replace(',', '.'));
    if (!Number.isFinite(quantidadeNumero) || quantidadeNumero <= 0) { setErro('Informe uma quantidade válida.'); return; }

    onSaveMovimento({
      id: `mv-${Date.now()}`,
      data,
      tipo,
      materialId: materialSelecionado.id,
      materialDescricao: materialSelecionado.descricao,
      quantidade: quantidadeNumero,
      unidade: materialSelecionado.unidade,
      ramoId,
      responsavel,
      criadoEm: new Date().toISOString(),
    });

    setConfirmado(`${tipo === 'Entrada' ? 'Recebimento' : 'Uso'} de ${quantidadeNumero} ${materialSelecionado.unidade} registrado.`);
    limpar();
    window.setTimeout(() => setConfirmado(null), 4000);
  };

  return (
    <div className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Utilização de Materiais"
        description="Lance o que chegou ou o que foi usado hoje, por ramo — rápido, direto do celular."
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTipo('Entrada')}
          className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
            tipo === 'Entrada' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" /> Recebido
        </button>
        <button
          type="button"
          onClick={() => setTipo('Saída')}
          className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
            tipo === 'Saída' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          <ArrowUpFromLine className="h-4 w-4" /> Utilizado
        </button>
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Material</span>
          <select
            value={materialId}
            onChange={event => setMaterialId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Selecione…</option>
            {materiaisAtivos.map(item => (
              <option key={item.id} value={item.id}>
                {item.descricao}{especificacao(item) ? ` (${especificacao(item)})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Ramo / Trecho</span>
          <select
            value={ramoId}
            onChange={event => setRamoId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Selecione…</option>
            {ramos.map(item => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Quantidade{materialSelecionado ? ` (${materialSelecionado.unidade})` : ''}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={quantidade}
              onChange={event => setQuantidade(event.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Data</span>
            <input
              type="date"
              value={data}
              onChange={event => setData(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        {erro && <p className="text-xs font-semibold text-rose-600">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          className="flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white transition hover:bg-emerald-800 active:bg-emerald-900"
        >
          Salvar lançamento
        </button>
      </div>

      {confirmado && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {confirmado}
        </p>
      )}
    </div>
  );
}

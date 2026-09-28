import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, PackagePlus, Pencil, Trash2, X } from 'lucide-react';
import type { ControleEstacas, LoteEstaca, ObraLocal } from '../../types';
import { buildStakeBalances, reconcileStakeInvoice } from '../../utils/stakeOperations';
import { inativar, somenteAtivos } from '../../utils/inativacao';
import { formatarData, moeda, numero } from '../../utils/formato';
import { ConfirmDialog } from '../../shared/ui';
import { useEntradaDeLista } from '../../shared/hooks/useEntradaDeLista';
import { BOTAO_PERIGO_LEVE, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, TOM_SITUACAO } from '../cadastros/estilos';

interface Props {
  hoje: string;
  controle: ControleEstacas;
  obras: readonly ObraLocal[];
  responsavel: string;
  onChange: (next: ControleEstacas, descricao: string) => void;
}

type Rascunho = Omit<LoteEstaca, 'id' | 'criadoEm'>;

const loteVazio = (hoje: string, responsavel: string): Rascunho => ({
  data: hoje, hora: '', movimento: 'Entrada', notaFiscal: '', materialCodigo: '', descricao: '',
  tipo: 'ESTACA PRANCHA', perfilModelo: '', comprimentoM: 0, unidade: 'UN', pesoKg: 0,
  quantidadeFisica: 1, valorUnitario: 0, valorTotal: 0, placaCavalo: '', placaCarreta: '',
  transportadora: '', destino: '', tipoCarregamento: 'Feixe central', status: 'Pendente',
  nfConferida: false, divergenciaNF: '', responsavel, observacao: '', origem: 'Manual',
});

const campoNumero = (valor: number) => (valor ? String(valor) : '');

/**
 * Recebimento das estacas pela nota fiscal: o que chegou, quanto já foi
 * cravado de cada lote e o saldo. Embaixo, a conferência de cada nota.
 */
export default function RecebimentosEstacas({ hoje, controle, obras, responsavel, onChange }: Props) {
  const [aberto, setAberto] = useState(false);
  const [lote, setLote] = useState<Rascunho>(() => loteVazio(hoje, responsavel));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState<string[] | null>(null);

  const lotes = useMemo(() => somenteAtivos(controle.lotes), [controle.lotes]);
  const saldos = useMemo(() => new Map(buildStakeBalances(controle).map(item => [item.loteId, item])), [controle]);
  const notas = useMemo(
    () => Array.from(new Set(lotes.map(item => item.notaFiscal).filter(Boolean))).map(nota => reconcileStakeInvoice(lotes, nota)),
    [lotes],
  );
  const lista = useEntradaDeLista<HTMLDivElement>([lotes.length]);

  const fechar = () => {
    setAberto(false);
    setEditandoId(null);
    setErro('');
    setLote(loteVazio(hoje, responsavel));
  };

  const salvar = (event: FormEvent) => {
    event.preventDefault();
    if (!lote.notaFiscal.trim() || !lote.descricao.trim() || lote.comprimentoM <= 0) {
      setErro('Informe a nota fiscal, a descrição e o comprimento.');
      return;
    }
    const anterior = editandoId ? controle.lotes.find(item => item.id === editandoId) : undefined;
    const agora = new Date().toISOString();
    const proximo: LoteEstaca = {
      ...lote,
      id: anterior?.id || `lote-estaca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      anexos: anterior?.anexos,
      valorTotal: lote.valorTotal || lote.pesoKg * lote.valorUnitario,
      criadoEm: anterior?.criadoEm || agora,
      atualizadoEm: agora,
    };
    onChange(
      { ...controle, lotes: anterior ? controle.lotes.map(item => (item.id === anterior.id ? proximo : item)) : [proximo, ...controle.lotes] },
      `${anterior ? 'Atualizou' : 'Registrou'} lote da NF ${lote.notaFiscal}.`,
    );
    fechar();
  };

  const editar = (item: LoteEstaca) => {
    const { id: _id, criadoEm: _criado, atualizadoEm: _atualizado, ...rascunho } = item;
    setLote(rascunho);
    setEditandoId(item.id);
    setAberto(true);
    setErro('');
  };

  // Lote é registro medido e pago: sai das telas e dos saldos, mas fica guardado.
  const inativarLotes = (ids: string[]) => onChange({
    lotes: inativar(controle.lotes, ids, responsavel),
    cravacoes: controle.cravacoes.map(item => (item.loteId && ids.includes(item.loteId) ? { ...item, loteId: undefined } : item)),
  }, ids.length === 1 ? 'Inativou um lote e preservou as cravações para reassociação.' : `Inativou ${ids.length} lote(s) e preservou as cravações.`);

  const campo = (rotulo: string, filho: ReactNode, largo = false) => (
    <label className={`space-y-1.5 ${largo ? 'sm:col-span-2' : ''}`}>
      <span className={ROTULO}>{rotulo}</span>
      {filho}
    </label>
  );

  return (
    <div className="space-y-4">
      <div data-estacas-reveal className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{lotes.length.toLocaleString('pt-BR')} lote(s) recebido(s) · {notas.filter(nota => nota.status !== 'Conforme').length} nota(s) para conferir</p>
        {!aberto && <button type="button" onClick={() => setAberto(true)} className={BOTAO_PRIMARIO}><PackagePlus className="size-5" aria-hidden="true" /> Novo recebimento</button>}
      </div>

      {aberto && (
        <form data-estacas-reveal onSubmit={salvar} className={`${CARTAO} space-y-4 p-4 sm:p-5`} noValidate>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">{editandoId ? `Corrigir NF ${lote.notaFiscal}` : 'Novo recebimento'}</h2>
            <button type="button" onClick={fechar} className={BOTAO_SECUNDARIO}><X className="size-5" aria-hidden="true" /> Fechar</button>
          </div>
          {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{erro}</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {campo('Dia', <input type="date" value={lote.data} onChange={e => setLote({ ...lote, data: e.target.value })} className={CAMPO} />)}
            {campo('Nota fiscal', <input value={lote.notaFiscal} onChange={e => setLote({ ...lote, notaFiscal: e.target.value })} className={CAMPO} />)}
            {campo('Código do material', <input value={lote.materialCodigo} onChange={e => setLote({ ...lote, materialCodigo: e.target.value })} className={CAMPO} />)}
            {campo('Perfil ou modelo', <input value={lote.perfilModelo} onChange={e => setLote({ ...lote, perfilModelo: e.target.value })} placeholder="Ex.: AZ 18-700" className={CAMPO} />)}
            {campo('Descrição', <input value={lote.descricao} onChange={e => setLote({ ...lote, descricao: e.target.value })} className={CAMPO} />, true)}
            {campo('Comprimento (m)', <input type="number" step="0.01" value={campoNumero(lote.comprimentoM)} onChange={e => setLote({ ...lote, comprimentoM: Number(e.target.value) })} className={CAMPO} />)}
            {campo('Quantidade de peças', <input type="number" step="1" value={campoNumero(lote.quantidadeFisica)} onChange={e => setLote({ ...lote, quantidadeFisica: Number(e.target.value) })} className={CAMPO} />)}
            {campo('Peso (kg)', <input type="number" step="0.01" value={campoNumero(lote.pesoKg)} onChange={e => setLote({ ...lote, pesoKg: Number(e.target.value) })} className={CAMPO} />)}
            {campo('Valor por kg (R$)', <input type="number" step="0.01" value={campoNumero(lote.valorUnitario)} onChange={e => setLote({ ...lote, valorUnitario: Number(e.target.value) })} className={CAMPO} />)}
            {campo('Placa do cavalo', <input value={lote.placaCavalo} onChange={e => setLote({ ...lote, placaCavalo: e.target.value.toUpperCase() })} className={CAMPO} />)}
            {campo('Placa da carreta', <input value={lote.placaCarreta} onChange={e => setLote({ ...lote, placaCarreta: e.target.value.toUpperCase() })} className={CAMPO} />)}
            {campo('Obra ou local', (
              <select value={lote.obraLocalId || ''} onChange={e => setLote({ ...lote, obraLocalId: e.target.value || undefined })} className={CAMPO}>
                <option value="">Não informar</option>
                {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            ))}
            {campo('Destino', <input value={lote.destino} onChange={e => setLote({ ...lote, destino: e.target.value })} className={CAMPO} />)}
            {campo('Responsável', <input value={lote.responsavel} onChange={e => setLote({ ...lote, responsavel: e.target.value })} className={CAMPO} />)}
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={lote.nfConferida} onChange={e => setLote({ ...lote, nfConferida: e.target.checked })} className="size-5 accent-[#176b4d]" /> Nota conferida
            </label>
          </div>
          <button type="submit" className={BOTAO_PRIMARIO}><PackagePlus className="size-5" aria-hidden="true" /> {editandoId ? 'Salvar correção' : 'Registrar recebimento'}</button>
        </form>
      )}

      {marcados.length > 0 && (
        <div className="flex justify-end"><button type="button" onClick={() => setConfirmando(marcados)} className={BOTAO_PERIGO_LEVE}><Trash2 className="size-4" aria-hidden="true" /> Tirar {marcados.length} marcado(s)</button></div>
      )}

      {!lotes.length ? (
        <p data-estacas-reveal className={`${CARTAO} p-8 text-center text-sm font-semibold text-slate-500`}>Nenhum recebimento lançado.</p>
      ) : (
        <div ref={lista} data-estacas-reveal className={`${CARTAO} overflow-x-auto`}>
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="bg-[#f7f8f6] text-xs font-bold uppercase tracking-wide text-[#718087]">
              <tr>
                <th className="w-10 px-3 py-3"><span className="sr-only">Marcar</span></th>
                <th className="px-3 py-3">Nota e dia</th>
                <th className="px-3 py-3">Material</th>
                <th className="px-3 py-3 text-right">Recebido</th>
                <th className="px-3 py-3 text-right">Cravado</th>
                <th className="px-3 py-3 text-right">Saldo</th>
                <th className="px-3 py-3">Nota</th>
                <th className="px-3 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lotes.map(item => {
                const saldo = saldos.get(item.id);
                return (
                  <tr key={item.id} data-linha-lista>
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Marcar NF ${item.notaFiscal}`} checked={marcados.includes(item.id)} onChange={() => setMarcados(atual => (atual.includes(item.id) ? atual.filter(id => id !== item.id) : [...atual, item.id]))} className="size-4 accent-[#176b4d]" /></td>
                    <td className="px-3 py-2"><b className="text-slate-900">NF {item.notaFiscal}</b><br /><span className="text-slate-600">{formatarData(item.data)}</span></td>
                    <td className="px-3 py-2 text-slate-700">{item.descricao}<br /><span className="text-slate-500">{item.perfilModelo || item.materialCodigo}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{numero(saldo?.recebidoM ?? 0, 2)} m</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{numero(saldo?.cravadoM ?? 0, 2)} m</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${saldo?.status === 'Divergente' ? 'text-rose-700' : 'text-[#176b4d]'}`}>{numero(saldo?.saldoConfirmadoM ?? 0, 2)} m</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.nfConferida ? TOM_SITUACAO.ok : TOM_SITUACAO.alerta}`}>{item.nfConferida ? 'Conferida' : 'Conferir'}</span></td>
                    <td className="px-3 py-1">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => editar(item)} aria-label={`Corrigir NF ${item.notaFiscal}`} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}><Pencil className="size-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => setConfirmando([item.id])} aria-label={`Tirar NF ${item.notaFiscal}`} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-rose-700 hover:bg-rose-50 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {notas.length > 0 && (
        <section data-estacas-reveal aria-labelledby="estacas-notas-titulo">
          <h2 id="estacas-notas-titulo" className="mb-2 text-base font-bold text-slate-900">Conferência das notas</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {notas.map(nota => (
              <div key={nota.notaFiscal} className={`${CARTAO} p-4`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">NF {nota.notaFiscal}</h3>
                  {nota.status === 'Conforme'
                    ? <CheckCircle2 className="size-5 text-[#176b4d]" aria-label="Conforme" />
                    : <AlertTriangle className="size-5 text-[#f26a2e]" aria-label="Pendente" />}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-sm text-slate-600">
                  <dt className="sr-only">Itens</dt><dd>{nota.itens} item(ns)</dd>
                  <dt className="sr-only">Peso</dt><dd>{numero(nota.pesoKg, 0)} kg</dd>
                  <dt className="sr-only">Valor</dt><dd>{moeda(nota.valorTotal)}</dd>
                  <dt className="sr-only">Conferidos</dt><dd>{nota.conferidos}/{nota.itens} conferidos</dd>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(confirmando)}
        tone="warning"
        title={confirmando?.length === 1 ? 'Tirar este recebimento?' : `Tirar ${confirmando?.length ?? 0} recebimentos?`}
        description="Saem das tabelas e dos saldos, mas continuam guardados e podem voltar. As cravações ficam, só sem o lote."
        confirmLabel="Tirar"
        onConfirm={() => {
          if (confirmando) inativarLotes(confirmando);
          setMarcados(atual => atual.filter(id => !confirmando?.includes(id)));
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
    </div>
  );
}

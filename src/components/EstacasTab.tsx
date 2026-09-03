import React, { useMemo, useState } from 'react';
import type ExcelJS from 'exceljs';
import { createCorporateWorkbook } from '../utils/excelCorporate';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Hammer, PackagePlus, Pencil, Trash2, X } from 'lucide-react';
import type { ControleEstacas, CravacaoEstaca, LoteEstaca, ObraLocal } from '../types';
import { buildStakeBalances, buildStakeSummary, reconcileStakeInvoice, suggestStakeLot } from '../utils/stakeOperations';
import { uploadOperationalAttachment } from '../services/operationalAttachments';
import StakeDrivingMap from './StakeDrivingMap';

type Props = {
  controle: ControleEstacas;
  obras: ObraLocal[];
  onChange: (next: ControleEstacas, description: string) => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const excelDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return text.slice(0, 10);
};
const excelTime = (value: unknown) => {
  if (value instanceof Date) return value.toTimeString().slice(0, 5);
  if (typeof value === 'number') {
    const minutes = Math.round((value - Math.floor(value)) * 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  return String(value || '').slice(0, 5);
};
const cellText = (value: ExcelJS.CellValue) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) return value.result as string | number | Date;
    if ('text' in value) return value.text;
    if ('richText' in value) return value.richText.map(item => item.text).join('');
  }
  return value as string | number;
};

const emptyLot = (): Omit<LoteEstaca, 'id' | 'criadoEm'> => ({
  data: today(), hora: '', movimento: 'Entrada', notaFiscal: '', materialCodigo: '', descricao: '',
  tipo: 'ESTACA PRANCHA', perfilModelo: '', comprimentoM: 0, unidade: 'UN', pesoKg: 0,
  quantidadeFisica: 1, valorUnitario: 0, valorTotal: 0, placaCavalo: '', placaCarreta: '',
  transportadora: '', destino: '', tipoCarregamento: 'Feixe central', status: 'Pendente',
  nfConferida: false, divergenciaNF: '', responsavel: '', observacao: '', origem: 'Manual',
});

const emptyDriving = (): Omit<CravacaoEstaca, 'id' | 'criadoEm'> => ({
  data: today(), item: '', servico: 'Cravação de estaca prancha', identificacao: '', perfil: '',
  comprimentoM: 0, comprimentoCravadoM: 0, sobraM: 0, perdaM: 0, responsavel: '',
  observacao: '', origem: 'Manual',
});

export default function EstacasTab({ controle, obras, onChange }: Props) {
  const [mode, setMode] = useState<'lotes' | 'cravacoes' | 'notas'>('lotes');
  const [lot, setLot] = useState(emptyLot);
  const [driving, setDriving] = useState(emptyDriving);
  const [lotFiles, setLotFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [activeDrivingId, setActiveDrivingId] = useState<string | null>(null);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editingDrivingId, setEditingDrivingId] = useState<string | null>(null);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [selectedDrivingIds, setSelectedDrivingIds] = useState<string[]>([]);
  const [visibleDrivingIds, setVisibleDrivingIds] = useState<string[]>(controle.cravacoes.map(item => item.id));
  const summary = useMemo(() => buildStakeSummary(controle), [controle]);
  const balances = useMemo(() => buildStakeBalances(controle), [controle]);
  const invoices = useMemo(
    () => Array.from(new Set(controle.lotes.map(item => item.notaFiscal).filter(Boolean))).map(nota => reconcileStakeInvoice(controle.lotes, nota)),
    [controle.lotes]
  );

  const saveLot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lot.notaFiscal || !lot.descricao || lot.comprimentoM <= 0) {
      setMessage('Informe NF, descrição e comprimento.');
      return;
    }
    if (lotFiles.length > 0 && !lot.obraLocalId) {
      setMessage('Selecione a obra antes de anexar arquivos ao lote.');
      return;
    }
    const previous = editingLotId ? controle.lotes.find(item => item.id === editingLotId) : undefined;
    const id = previous?.id || uid('lote-estaca');
    let anexos: LoteEstaca['anexos'] = [];
    try {
      anexos = await Promise.all(lotFiles.map(file => uploadOperationalAttachment({
        obraId: lot.obraLocalId || 'geral',
        module: 'estacas-lotes',
        recordId: id,
      }, file)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar os anexos.');
      return;
    }
    const nextLot: LoteEstaca = {
      ...lot,
      id,
      anexos: anexos.length > 0 ? anexos : previous?.anexos,
      valorTotal: lot.valorTotal || lot.pesoKg * lot.valorUnitario,
      criadoEm: previous?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    const nextLots = previous
      ? controle.lotes.map(item => item.id === previous.id ? nextLot : item)
      : [nextLot, ...controle.lotes];
    onChange({ ...controle, lotes: nextLots }, `${previous ? 'Atualizou' : 'Registrou'} lote da NF ${lot.notaFiscal}.`);
    setLot(emptyLot());
    setEditingLotId(null);
    setLotFiles([]);
    setMessage(previous ? 'Recebimento atualizado.' : 'Recebimento registrado.');
  };

  const editLot = (item: LoteEstaca) => {
    const { id: _id, criadoEm: _createdAt, atualizadoEm: _updatedAt, ...draft } = item;
    setLot(draft);
    setEditingLotId(item.id);
    setMode('lotes');
    setMessage(`Editando o lote da NF ${item.notaFiscal}.`);
  };

  const cancelLotEdit = () => {
    setLot(emptyLot());
    setEditingLotId(null);
    setLotFiles([]);
  };

  const saveDriving = (event: React.FormEvent) => {
    event.preventDefault();
    if (!driving.identificacao || driving.comprimentoM <= 0 || driving.comprimentoCravadoM < 0) {
      setMessage('Informe identificação, comprimento válido e profundidade cravada maior ou igual a zero.');
      return;
    }
    if (driving.comprimentoCravadoM > driving.comprimentoM) {
      setMessage('A profundidade cravada informada é superior ao comprimento total da estaca. Verifique a medição.');
      return;
    }
    const suggested = driving.loteId ? undefined : suggestStakeLot(driving, controle);
    const previous = editingDrivingId ? controle.cravacoes.find(item => item.id === editingDrivingId) : undefined;
    const nextDriving: CravacaoEstaca = {
      ...driving,
      loteId: driving.loteId || suggested?.id,
      sobraM: Math.max(0, driving.sobraM || driving.comprimentoM - driving.comprimentoCravadoM - driving.perdaM),
      id: previous?.id || uid('cravacao-estaca'),
      criadoEm: previous?.criadoEm || new Date().toISOString(),
    };
    const nextItems = previous
      ? controle.cravacoes.map(item => item.id === previous.id ? nextDriving : item)
      : [nextDriving, ...controle.cravacoes];
    onChange({ ...controle, cravacoes: nextItems }, `${previous ? 'Atualizou' : 'Registrou'} cravação ${driving.identificacao}.`);
    setDriving(emptyDriving());
    setEditingDrivingId(null);
    setActiveDrivingId(nextDriving.id);
    setMessage(previous ? 'Cravação atualizada e mapa sincronizado.' : suggested ? `Cravação registrada e associada ao lote da NF ${suggested.notaFiscal}.` : 'Cravação registrada.');
  };

  const editDriving = (item: CravacaoEstaca) => {
    const { id: _id, criadoEm: _createdAt, ...draft } = item;
    setDriving(draft);
    setEditingDrivingId(item.id);
    setActiveDrivingId(item.id);
    setMode('cravacoes');
    setMessage(`Editando ${item.identificacao}. Salve para atualizar também o mapa.`);
    requestAnimationFrame(() => document.getElementById('stake-driving-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const cancelDrivingEdit = () => {
    setDriving(emptyDriving());
    setEditingDrivingId(null);
    setActiveDrivingId(null);
    setMessage('Edição cancelada sem alterar o registro.');
  };

  const importWorkbook = async (file: File) => {
    setIsImporting(true);
    setMessage('');
    try {
      const workbook = await createCorporateWorkbook();
      await workbook.xlsx.load(await file.arrayBuffer() as any);
      const importedLots: LoteEstaca[] = [];
      const importedDrivings: CravacaoEstaca[] = [];
      const launchSheet = workbook.getWorksheet('Lançamentos');
      launchSheet?.eachRow((row, rowNumber) => {
        if (rowNumber <= 5) return;
        const values = Array.from({ length: 18 }, (_, index) => cellText(row.getCell(index + 1).value));
        if (!values.some(Boolean)) return;
        const [data, hora, movimento, nf, codigo, descricao, tipo, comprimento, unidade, peso, valorUnitario, valorTotal, cavalo, carreta, transportadora, destino, carregamento, status] = values;
        importedLots.push({
          ...emptyLot(),
          id: uid(`lote-${rowNumber}`),
          data: excelDate(data),
          hora: excelTime(hora),
          movimento: (String(movimento || 'Entrada') as LoteEstaca['movimento']),
          notaFiscal: String(nf || ''),
          materialCodigo: String(codigo || ''),
          descricao: String(descricao || `Linha ${rowNumber} sem descrição`),
          tipo: String(tipo || 'OUTROS'),
          perfilModelo: String(descricao || '').match(/\bAZ[0-9-]+\b/i)?.[0] || '',
          comprimentoM: numberValue(comprimento),
          unidade: String(unidade || 'UN'),
          pesoKg: numberValue(peso),
          valorUnitario: numberValue(valorUnitario),
          valorTotal: numberValue(valorTotal),
          placaCavalo: String(cavalo || ''),
          placaCarreta: String(carreta || ''),
          transportadora: String(transportadora || ''),
          destino: String(destino || ''),
          tipoCarregamento: String(carregamento || ''),
          status: (String(status || 'Pendente') as LoteEstaca['status']),
          origem: 'Planilha',
          observacao: !nf || !descricao ? 'Importado com campos incompletos; revisar.' : '',
          criadoEm: new Date().toISOString(),
        });
      });
      const drivingSheet = workbook.getWorksheet('Cravações');
      drivingSheet?.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const values = Array.from({ length: 7 }, (_, index) => cellText(row.getCell(index + 1).value));
        if (!values.some(Boolean)) return;
        const [data, item, servico, identificacao, perfil, comprimento, cravado] = values;
        const draft = {
          ...emptyDriving(),
          data: excelDate(data),
          item: String(item || rowNumber - 1),
          servico: String(servico || 'Cravação de estaca prancha'),
          identificacao: String(identificacao || `Linha ${rowNumber}`),
          perfil: String(perfil || ''),
          comprimentoM: numberValue(comprimento),
          comprimentoCravadoM: numberValue(cravado),
          sobraM: Math.max(0, numberValue(comprimento) - numberValue(cravado)),
          origem: 'Planilha' as const,
        };
        importedDrivings.push({
          ...draft,
          loteId: suggestStakeLot(draft, { lotes: [...importedLots, ...controle.lotes], cravacoes: [...importedDrivings, ...controle.cravacoes] })?.id,
          id: uid(`cravacao-${rowNumber}`),
          criadoEm: new Date().toISOString(),
        });
      });
      onChange(
        { lotes: [...importedLots, ...controle.lotes], cravacoes: [...importedDrivings, ...controle.cravacoes] },
        `Importou ${importedLots.length} lote(s) e ${importedDrivings.length} cravação(ões) da planilha.`
      );
      setMessage(`Importação preservada: ${importedLots.length} lotes e ${importedDrivings.length} cravações. Linhas incompletas ficaram pendentes.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar a planilha.');
    } finally {
      setIsImporting(false);
    }
  };

  const removeLot = (id: string) => onChange({
    lotes: controle.lotes.filter(item => item.id !== id),
    cravacoes: controle.cravacoes.map(item => item.loteId === id ? { ...item, loteId: undefined } : item),
  }, 'Excluiu um lote e preservou as cravações para reassociação.');
  const removeDriving = (id: string) => {
    onChange({ ...controle, cravacoes: controle.cravacoes.filter(item => item.id !== id) }, 'Excluiu uma cravação.');
    if (editingDrivingId === id) cancelDrivingEdit();
  };
  const removeSelectedLots = () => {
    if (selectedLotIds.length === 0 || !window.confirm(`Excluir ${selectedLotIds.length} lote(s) selecionado(s)? As cravações serão preservadas para reassociação.`)) return;
    const selected = new Set(selectedLotIds);
    onChange({
      lotes: controle.lotes.filter(item => !selected.has(item.id)),
      cravacoes: controle.cravacoes.map(item => item.loteId && selected.has(item.loteId) ? { ...item, loteId: undefined } : item),
    }, `Excluiu ${selected.size} lote(s) selecionado(s) e preservou as cravações.`);
    setSelectedLotIds([]);
  };
  const removeSelectedDrivings = () => {
    if (selectedDrivingIds.length === 0 || !window.confirm(`Excluir ${selectedDrivingIds.length} cravação(ões) selecionada(s)?`)) return;
    const selected = new Set(selectedDrivingIds);
    onChange({ ...controle, cravacoes: controle.cravacoes.filter(item => !selected.has(item.id)) }, `Excluiu ${selected.size} cravação(ões) selecionada(s).`);
    setSelectedDrivingIds([]);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-500/20 bg-slate-950 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">ERP v2.6</p>
            <h2 className="mt-1 text-2xl font-black text-white">Controle de Estacas</h2>
            <p className="mt-1 text-xs text-slate-400">Recebimento, NF, lote físico, cravação, sobra, perda e saldo confirmado.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500">
            <FileSpreadsheet className="h-4 w-4" />
            {isImporting ? 'Importando...' : 'Importar controle Excel'}
            <input type="file" accept=".xlsx" className="hidden" disabled={isImporting} onChange={event => {
              const file = event.target.files?.[0];
              if (file) void importWorkbook(file);
              event.target.value = '';
            }} />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Lotes', summary.lotes],
          ['Cravações', summary.cravacoes],
          ['Recebido (m)', summary.recebidoM.toLocaleString('pt-BR')],
          ['Cravado (m)', summary.cravadoM.toLocaleString('pt-BR')],
          ['Saldo (m)', summary.sobraM.toLocaleString('pt-BR')],
          ['NF pendente', summary.notasPendentes],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-200">{message}</div>}

      <div className="flex gap-2 overflow-auto">
        {([['lotes', 'Recebimentos'], ['cravacoes', 'Cravações'], ['notas', 'Conferência de NF']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)} className={`rounded-lg px-4 py-2 text-xs font-black ${mode === id ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'}`}>{label}</button>
        ))}
      </div>

      {mode === 'lotes' && (
        <>
          <form onSubmit={saveLot} className="grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <input type="date" value={lot.data} onChange={e => setLot({ ...lot, data: e.target.value })} className="input-dark" />
            <input placeholder="Nota fiscal" value={lot.notaFiscal} onChange={e => setLot({ ...lot, notaFiscal: e.target.value })} className="input-dark" />
            <input placeholder="Código do material" value={lot.materialCodigo} onChange={e => setLot({ ...lot, materialCodigo: e.target.value })} className="input-dark" />
            <input placeholder="Perfil / modelo" value={lot.perfilModelo} onChange={e => setLot({ ...lot, perfilModelo: e.target.value })} className="input-dark" />
            <input placeholder="Descrição" value={lot.descricao} onChange={e => setLot({ ...lot, descricao: e.target.value })} className="input-dark md:col-span-2" />
            <input type="number" step="0.01" placeholder="Comprimento (m)" value={lot.comprimentoM || ''} onChange={e => setLot({ ...lot, comprimentoM: Number(e.target.value) })} className="input-dark" />
            <input type="number" step="1" placeholder="Quantidade física" value={lot.quantidadeFisica || ''} onChange={e => setLot({ ...lot, quantidadeFisica: Number(e.target.value) })} className="input-dark" />
            <input type="number" step="0.01" placeholder="Peso (kg)" value={lot.pesoKg || ''} onChange={e => setLot({ ...lot, pesoKg: Number(e.target.value) })} className="input-dark" />
            <input type="number" step="0.01" placeholder="Valor unitário" value={lot.valorUnitario || ''} onChange={e => setLot({ ...lot, valorUnitario: Number(e.target.value) })} className="input-dark" />
            <input placeholder="Placa cavalo" value={lot.placaCavalo} onChange={e => setLot({ ...lot, placaCavalo: e.target.value.toUpperCase() })} className="input-dark" />
            <input placeholder="Placa carreta" value={lot.placaCarreta} onChange={e => setLot({ ...lot, placaCarreta: e.target.value.toUpperCase() })} className="input-dark" />
            <select value={lot.obraLocalId || ''} onChange={e => setLot({ ...lot, obraLocalId: e.target.value || undefined })} className="input-dark"><option value="">Obra/local</option>{obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
            <input placeholder="Destino textual" value={lot.destino} onChange={e => setLot({ ...lot, destino: e.target.value })} className="input-dark md:col-span-2" />
            <input placeholder="Responsável" value={lot.responsavel} onChange={e => setLot({ ...lot, responsavel: e.target.value })} className="input-dark" />
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 sm:col-span-2">Anexos estão temporariamente indisponíveis. O registro do lote segue normalmente, sem perda dos demais dados.</div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs text-slate-300"><input type="checkbox" checked={lot.nfConferida} onChange={e => setLot({ ...lot, nfConferida: e.target.checked })} /> NF conferida</label>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white"><PackagePlus className="h-4 w-4" /> {editingLotId ? 'Salvar alterações' : 'Registrar lote'}</button>
            {editingLotId && <button type="button" onClick={cancelLotEdit} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"><X className="h-4 w-4" /> Cancelar edição</button>}
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <label className="flex items-center gap-2 font-bold text-slate-700"><input type="checkbox" checked={controle.lotes.length > 0 && selectedLotIds.length === controle.lotes.length} onChange={e => setSelectedLotIds(e.target.checked ? controle.lotes.map(item => item.id) : [])} /> Selecionar todos ({selectedLotIds.length})</label>
            <button type="button" disabled={selectedLotIds.length === 0} onClick={removeSelectedLots} className="rounded-lg bg-rose-600 px-3 py-2 font-black text-white disabled:opacity-40"><Trash2 className="mr-1 inline h-4 w-4" /> Excluir selecionados</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-900 text-[9px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Sel.</th><th>Data/NF</th><th>Material</th><th>Perfil</th><th>Recebido</th><th>Cravado</th><th>Saldo</th><th>Status</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950">
                {controle.lotes.map(item => {
                  const balance = balances.find(entry => entry.loteId === item.id);
                  return <tr key={item.id}><td className="p-3"><input type="checkbox" checked={selectedLotIds.includes(item.id)} onChange={e => setSelectedLotIds(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /></td><td className="text-slate-300">{item.data}<br /><b className="text-white">NF {item.notaFiscal}</b></td><td className="text-slate-300">{item.descricao}<br /><span className="text-slate-600">{item.materialCodigo}</span></td><td className="text-slate-300">{item.perfilModelo || item.comprimentoM}</td><td className="text-slate-300">{balance?.recebidoM} m</td><td className="text-slate-300">{balance?.cravadoM} m</td><td className={balance?.status === 'Divergente' ? 'font-black text-rose-400' : 'font-black text-emerald-400'}>{balance?.saldoConfirmadoM} m</td><td className="text-slate-400">{item.nfConferida ? 'NF conferida' : item.status}</td><td><button type="button" title="Editar lote" onClick={() => editLot(item)} className="p-2 text-sky-400"><Pencil className="h-4 w-4" /></button><button type="button" title="Excluir lote" onClick={() => removeLot(item.id)} className="p-2 text-rose-400"><Trash2 className="h-4 w-4" /></button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mode === 'cravacoes' && (
        <>
          <StakeDrivingMap
            items={controle.cravacoes}
            obras={obras}
            activeId={activeDrivingId}
            onActiveIdChange={setActiveDrivingId}
            onVisibleIdsChange={setVisibleDrivingIds}
          />
          <form id="stake-driving-form" onSubmit={saveDriving} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <input type="date" value={driving.data} onChange={e => setDriving({ ...driving, data: e.target.value })} className="input-dark" />
            <input placeholder="Identificação / frente" value={driving.identificacao} onChange={e => setDriving({ ...driving, identificacao: e.target.value })} className="input-dark" />
            <input placeholder="Perfil" value={driving.perfil} onChange={e => setDriving({ ...driving, perfil: e.target.value })} className="input-dark" />
            <input placeholder="Item físico" value={driving.item} onChange={e => setDriving({ ...driving, item: e.target.value })} className="input-dark" />
            <input type="number" step="0.01" placeholder="Comprimento (m)" value={driving.comprimentoM || ''} onChange={e => setDriving({ ...driving, comprimentoM: Number(e.target.value) })} className="input-dark" />
            <input type="number" step="0.01" placeholder="Cravado (m)" value={driving.comprimentoCravadoM || ''} onChange={e => setDriving({ ...driving, comprimentoCravadoM: Number(e.target.value) })} className="input-dark" />
            <input type="number" step="0.01" placeholder="Perda (m)" value={driving.perdaM || ''} onChange={e => setDriving({ ...driving, perdaM: Number(e.target.value) })} className="input-dark" />
            <select value={driving.loteId || ''} onChange={e => setDriving({ ...driving, loteId: e.target.value || undefined })} className="input-dark"><option value="">Associação automática</option>{controle.lotes.map(item => <option key={item.id} value={item.id}>NF {item.notaFiscal} · {item.perfilModelo || item.descricao}</option>)}</select>
            <select value={driving.obraLocalId || ''} onChange={e => setDriving({ ...driving, obraLocalId: e.target.value || undefined })} className="input-dark"><option value="">Obra/local</option>{obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
            <input placeholder="Responsável" value={driving.responsavel} onChange={e => setDriving({ ...driving, responsavel: e.target.value })} className="input-dark" />
            <button className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white"><Hammer className="h-4 w-4" /> {editingDrivingId ? 'Salvar alterações' : 'Registrar cravação'}</button>
            {editingDrivingId && <button type="button" onClick={cancelDrivingEdit} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-slate-400"><X className="h-4 w-4" /> Cancelar edição</button>}
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <label className="flex items-center gap-2 font-bold text-slate-700"><input type="checkbox" checked={visibleDrivingIds.length > 0 && visibleDrivingIds.every(id => selectedDrivingIds.includes(id))} onChange={e => setSelectedDrivingIds(e.target.checked ? visibleDrivingIds : [])} /> Selecionar visíveis ({selectedDrivingIds.length})</label>
            <button type="button" disabled={selectedDrivingIds.length === 0} onClick={removeSelectedDrivings} className="rounded-lg bg-rose-600 px-3 py-2 font-black text-white disabled:opacity-40"><Trash2 className="mr-1 inline h-4 w-4" /> Excluir selecionadas</button>
          </div>
          <div className="grid gap-3">
            {controle.cravacoes.filter(item => visibleDrivingIds.includes(item.id)).sort((a, b) => a.identificacao.localeCompare(b.identificacao, 'pt-BR', { numeric: true })).map(item => <div id={`stake-row-${item.id}`} key={item.id} onMouseEnter={() => setActiveDrivingId(item.id)} onMouseLeave={() => editingDrivingId !== item.id && setActiveDrivingId(null)} className={`flex flex-col gap-2 rounded-xl border bg-white p-4 transition md:flex-row md:items-center ${activeDrivingId === item.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200'}`}><input type="checkbox" checked={selectedDrivingIds.includes(item.id)} onChange={e => setSelectedDrivingIds(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><div className="flex-1"><p className="font-black text-slate-900">{item.identificacao} · {item.perfil || 'Perfil não informado'}</p><p className="text-xs text-slate-500">{item.data} · {item.comprimentoCravadoM} / {item.comprimentoM} m · sobra {item.sobraM} m · perda {item.perdaM} m</p></div><span className={`text-[10px] font-black ${item.loteId ? 'text-emerald-700' : 'text-amber-700'}`}>{item.loteId ? 'LOTE ASSOCIADO' : 'REVISAR LOTE'}</span><button type="button" title="Editar cravação" onClick={() => editDriving(item)} className="p-2 text-sky-600 hover:text-sky-800"><Pencil className="h-4 w-4" /></button><button type="button" title="Excluir cravação" onClick={() => removeDriving(item.id)} className="p-2 text-rose-500"><Trash2 className="h-4 w-4" /></button></div>)}
          </div>
        </>
      )}

      {mode === 'notas' && (
        <div className="grid gap-3 md:grid-cols-2">
          {invoices.map(invoice => <div key={invoice.notaFiscal} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><h3 className="font-black text-white">NF {invoice.notaFiscal}</h3>{invoice.status === 'Conforme' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-amber-400" />}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400"><span>{invoice.itens} item(ns)</span><span>{invoice.pesoKg.toLocaleString('pt-BR')} kg</span><span>R$ {invoice.valorTotal.toLocaleString('pt-BR')}</span><span>{invoice.conferidos}/{invoice.itens} conferidos</span></div></div>)}
        </div>
      )}
    </div>
  );
}

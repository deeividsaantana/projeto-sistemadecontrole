/**
 * Utilização de materiais por ramo: quanto chegou, quanto foi aplicado e o
 * percentual, material a material. O uso entra pelo link dos apontadores ou
 * pelo botão "Apontar uso" desta tela; os dois gravam a mesma saída de consumo.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle, Check, ChevronDown, Copy, ExternalLink, Link2, Minus, Package, Plus, RotateCcw, Search, Undo2 } from 'lucide-react';
import type { EtapaServico, Material, MovimentoMaterial } from '../types';
import { groupUsageByBranch, materialUsageByBranch, type MaterialBranchUsage } from '../modules/materials/materialUsage';
import { cancelMaterialMovement, linkMovementsToBranch, unlinkedReceiptDestinations } from '../modules/materials/materialFieldUse';
import { formatMaterialQuantity, fromPieces, pieceLength, toPieces, unitLabel } from '../modules/materials/materialPieces';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { formatarData } from '../utils/formato';
import { EmptyState, FilterBar, Modal, isoDay } from '../shared/ui';
import { getSecurePublicMaterialLink } from '../publicApi';

interface Props {
  materiais: Material[];
  movimentos: MovimentoMaterial[];
  etapas: EtapaServico[];
  responsavel: string;
  podeEditar: boolean;
  onSaveMovimentos: (movimentos: MovimentoMaterial[], descricao: string) => void;
  onUpdateMovimentos: (movimentos: MovimentoMaterial[], descricao: string, acao?: 'Editou' | 'Excluiu') => void;
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60';
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const percentText = (value: number | null) => value === null ? 'Sem entrada' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Unidade em que se conta no campo: peça quando o material tem comprimento de peça. */
const countUnit = (material?: Material) => (pieceLength(material) ? 'pç' : unitLabel(material?.unidade || ''));
const inCountUnit = (material: Material | undefined, quantity: number) => toPieces(material, quantity) ?? quantity;

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export default function MateriaisUtilizacaoPanel({ materiais, movimentos, etapas, responsavel, podeEditar, onSaveMovimentos, onUpdateMovimentos }: Props) {
  const escopo = useRef<HTMLElement>(null);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState('');
  const [link, setLink] = useState<{ estado: 'fechado' | 'carregando' | 'pronto' | 'erro'; url?: string; erro?: string; copiado?: boolean }>({ estado: 'fechado' });
  const [vinculos, setVinculos] = useState<Record<string, string>>({});
  const [apontar, setApontar] = useState<{ ramoId: string; data: string; quantidades: Record<string, string> } | null>(null);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState('');

  const catalogo = useMemo(() => new Map(materiais.map(item => [item.id, item])), [materiais]);
  const linhas = useMemo(() => materialUsageByBranch(materiais, movimentos), [materiais, movimentos]);
  const termo = normalizeComparable(busca).trim();
  const grupos = useMemo(() => groupUsageByBranch(linhas.filter(item => !termo
    || normalizeComparable(`${item.branchName} ${item.materialDescription}`).includes(termo))), [linhas, termo]);
  const semRamo = useMemo(() => unlinkedReceiptDestinations(movimentos, etapas), [movimentos, etapas]);

  const resumo = useMemo(() => {
    const comEntrada = linhas.filter(item => item.percent !== null);
    return {
      ramos: new Set(linhas.map(item => item.branchId)).size,
      materiais: linhas.length,
      // Metro de tubo e peça de madeira não se somam: o uso geral é a média dos percentuais.
      mediaUso: comEntrada.length ? comEntrada.reduce((soma, item) => soma + (item.percent || 0), 0) / comEntrada.length : null,
      acima: linhas.filter(item => item.received > 0 && item.used > item.received).length,
      semEntrada: linhas.filter(item => item.received === 0).length,
    };
  }, [linhas]);

  useGSAP(() => {
    if (!escopo.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(escopo.current.querySelectorAll('[data-uso-reveal]'), { opacity: 0, y: 12 }, {
      opacity: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity',
    });
  }, { scope: escopo, dependencies: [grupos.length, termo] });

  const usosDoMaterial = (item: MaterialBranchUsage) => movimentos
    .filter(mov => mov.materialId === item.materialId && mov.etapaServicoId === item.branchId && mov.tipo === 'Saída' && mov.finalidade === 'Consumo')
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 8);

  const gerarLink = async () => {
    setLink({ estado: 'carregando' });
    try {
      setLink({ estado: 'pronto', url: await getSecurePublicMaterialLink() });
    } catch (error) {
      setLink({ estado: 'erro', erro: error instanceof Error ? error.message : 'Não foi possível gerar o link.' });
    }
  };

  const copiarLink = async () => {
    if (!link.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setLink(atual => ({ ...atual, copiado: true }));
    } catch {
      setLink(atual => ({ ...atual, erro: 'O navegador não deixou copiar. Selecione o endereço e copie.' }));
    }
  };

  const vincular = (destino: string, ids: string[]) => {
    const ramo = etapas.find(item => item.id === (vinculos[destino] ?? semRamo.find(grupo => grupo.destino === destino)?.suggestedBranchId));
    if (!ramo) return;
    const alterados = linkMovementsToBranch(movimentos, new Set(ids), ramo);
    onUpdateMovimentos(alterados, `Vinculou ${alterados.length} entrada(s) com destino "${destino}" ao ramo ${ramo.nome}.`);
  };

  const desfazer = (movimento: MovimentoMaterial) => {
    onUpdateMovimentos([cancelMaterialMovement(movimento, responsavel)], `Desfez o uso de ${movimento.quantidade} ${movimento.unidade} de ${movimento.materialDescricao} no ${movimento.etapaServicoNome || 'ramo'}.`, 'Excluiu');
    setConfirmarDesfazer('');
  };

  // Ramos que têm alguma entrada vinculada: é onde faz sentido apontar uso.
  const ramosComEntrada = useMemo(() => groupUsageByBranch(linhas.filter(item => item.received > 0)), [linhas]);
  const ramoApontado = apontar ? ramosComEntrada.find(item => item.branchId === apontar.ramoId) : undefined;
  const itensApontados = (ramoApontado?.rows || [])
    .map(row => ({ row, contagem: Number(String(apontar?.quantidades[row.materialId] || '').replace(',', '.')) }))
    .filter(entry => Number.isFinite(entry.contagem) && entry.contagem > 0);

  const abrirApontar = (ramoId = '') => setApontar({ ramoId: ramoId || (ramosComEntrada.length === 1 ? ramosComEntrada[0].branchId : ''), data: isoDay(new Date()), quantidades: {} });

  const ajustarApontado = (materialId: string, delta: number) => setApontar(atual => {
    if (!atual) return atual;
    const valor = Number(String(atual.quantidades[materialId] || '0').replace(',', '.')) || 0;
    const proximo = Math.max(0, Number((valor + delta).toFixed(2)));
    return { ...atual, quantidades: { ...atual.quantidades, [materialId]: proximo ? String(proximo).replace('.', ',') : '' } };
  });

  const salvarApontamento = () => {
    if (!apontar || !ramoApontado || itensApontados.length === 0) return;
    const agora = new Date().toISOString();
    const envio = newId();
    const novos: MovimentoMaterial[] = itensApontados.map(({ row, contagem }, index) => {
      const material = catalogo.get(row.materialId);
      return {
        id: `uso-erp-${envio}-${index + 1}`,
        data: apontar.data,
        tipo: 'Saída',
        finalidade: 'Consumo',
        materialId: row.materialId,
        materialDescricao: row.materialDescription,
        quantidade: fromPieces(material, contagem),
        unidade: row.unit,
        etapaServicoId: row.branchId,
        etapaServicoNome: row.branchName,
        destino: row.branchName,
        apontadoPor: responsavel,
        responsavel,
        criadoEm: agora,
      };
    });
    onSaveMovimentos(novos, `Apontou uso no ${ramoApontado.branchName}: ${itensApontados.map(({ row, contagem }) => `${number(contagem)} ${countUnit(catalogo.get(row.materialId))} de ${row.materialDescription}`).join('; ')}.`);
    setApontar(null);
  };

  return (
    <section ref={escopo} className="mt-3 space-y-3" aria-label="Utilização de materiais por ramo">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: 'Uso médio', valor: resumo.mediaUso === null ? 'Sem entrada' : `${resumo.mediaUso.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, detalhe: 'do que chegou em cada ramo' },
          { label: 'Ramos acompanhados', valor: String(resumo.ramos), detalhe: `${resumo.materiais} material(is) vinculado(s)` },
          { label: 'Acima do recebido', valor: String(resumo.acima), detalhe: resumo.acima ? 'conferir entrada ou ramo' : 'nenhum excesso', alerta: resumo.acima > 0 },
          { label: 'Entradas sem ramo', valor: String(semRamo.reduce((soma, item) => soma + item.movementIds.length, 0)), detalhe: semRamo.length ? 'vincule abaixo para contar' : 'tudo vinculado', alerta: semRamo.length > 0 },
        ].map(item => (
          <article key={item.label} data-uso-reveal className={`renea-card rounded-2xl border bg-white p-3.5 sm:p-4 ${item.alerta ? 'border-[#f26a2e]/40' : 'border-slate-200'}`}>
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <strong className={`mt-1 block text-2xl font-black tabular-nums ${item.alerta ? 'text-[#b3461a]' : 'text-slate-950'}`}>{item.valor}</strong>
            <span className="mt-1 block text-xs leading-4 text-slate-500">{item.detalhe}</span>
          </article>
        ))}
      </div>

      <FilterBar
        label="Busca da utilização"
        actions={podeEditar ? (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button type="button" onClick={() => void gerarLink()} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 active:scale-[0.98] ${focusRing}`}>
              <Link2 className="h-4 w-4" /> Link dos apontadores
            </button>
            <button type="button" onClick={() => abrirApontar()} disabled={ramosComEntrada.length === 0} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800 active:scale-[0.98] disabled:bg-slate-300 ${focusRing}`}>
              <Plus className="h-4 w-4" /> Apontar uso
            </button>
          </div>
        ) : undefined}
      >
        <label className="relative block min-w-48 flex-1">
          <span className="sr-only">Buscar ramo ou material</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Ramo ou material"
            className={`min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500 ${focusRing}`}
          />
        </label>
      </FilterBar>

      {link.estado !== 'fechado' && (
        <article data-uso-reveal className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-slate-950">Link dos apontadores</h2>
              <p className="mt-1 text-xs text-slate-600">Mande pelo WhatsApp. Abre no celular sem senha; cada um informa o nome uma vez.</p>
            </div>
            <button type="button" onClick={() => setLink({ estado: 'fechado' })} className={`min-h-9 rounded-xl px-2 text-xs font-bold text-slate-500 hover:text-slate-800 ${focusRing}`}>Fechar</button>
          </div>
          {link.estado === 'carregando' && <p className="mt-3 text-xs font-bold text-slate-500">Gerando o link protegido...</p>}
          {link.url && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input readOnly value={link.url} onFocus={event => event.target.select()} aria-label="Endereço do link dos apontadores" className={`min-h-11 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 font-mono text-xs text-slate-700 ${focusRing}`} />
              <button type="button" onClick={() => void copiarLink()} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 active:scale-[0.98] ${focusRing}`}>
                {link.copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {link.copiado ? 'Copiado' : 'Copiar'}
              </button>
              <a href={link.url} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-emerald-500 ${focusRing}`}>
                <ExternalLink className="h-4 w-4" /> Abrir
              </a>
            </div>
          )}
          {link.erro && <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-bold text-[#b3461a]"><AlertTriangle className="h-4 w-4" /> {link.erro}</p>}
        </article>
      )}

      {podeEditar && semRamo.length > 0 && (
        <article data-uso-reveal className="rounded-2xl border border-[#f26a2e]/40 bg-[#fff7f2] p-4">
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-950"><AlertTriangle className="h-4 w-4 text-[#f26a2e]" /> Entradas que ainda não contam</h2>
          <p className="mt-1 text-xs text-slate-600">Estas notas têm o local escrito à mão. Escolha o ramo cadastrado e toque em Vincular. Nada é apagado.</p>
          <ul className="mt-3 grid gap-2">
            {semRamo.slice(0, 8).map(grupo => {
              const escolhido = vinculos[grupo.destino] ?? grupo.suggestedBranchId ?? '';
              return (
                <li key={grupo.destino} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-center">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-slate-900">{grupo.destino}</strong>
                    <span className="text-xs text-slate-500">{grupo.movementIds.length} entrada(s)</span>
                  </div>
                  <select
                    value={escolhido}
                    onChange={event => setVinculos(atual => ({ ...atual, [grupo.destino]: event.target.value }))}
                    aria-label={`Ramo para ${grupo.destino}`}
                    className={`min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 ${focusRing}`}
                  >
                    <option value="">Escolha o ramo</option>
                    {etapas.map(etapa => <option key={etapa.id} value={etapa.id}>{etapa.nome}</option>)}
                  </select>
                  <button type="button" disabled={!escolhido} onClick={() => vincular(grupo.destino, grupo.movementIds)} className={`min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 active:scale-[0.98] disabled:bg-slate-300 ${focusRing}`}>
                    Vincular
                  </button>
                </li>
              );
            })}
          </ul>
          {etapas.length === 0 && <p className="mt-2 text-xs font-bold text-slate-600">Nenhum ramo cadastrado ainda. Cadastre em Cadastros, na área Ramos / Trechos.</p>}
        </article>
      )}

      {grupos.length === 0 ? (
        <EmptyState
          icon={Package}
          title={termo ? 'Nada encontrado' : 'Nenhum material vinculado a um ramo'}
          description={termo ? 'Tente outro ramo ou material.' : 'Importe a planilha de recebimento ou lance uma entrada com o ramo. Depois o uso aparece aqui, material por material.'}
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {grupos.map(grupo => (
            <article key={grupo.branchId} data-uso-reveal className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby={`ramo-${grupo.branchId}`}>
              <header className="flex items-end justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-4">
                <div className="min-w-0">
                  <h2 id={`ramo-${grupo.branchId}`} className="truncate text-base font-black text-slate-950">{grupo.branchName}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{grupo.rows.length} material(is){grupo.mixedUnits ? ' · uso médio entre eles' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid justify-items-end">
                    <strong className={`text-3xl font-black leading-none tabular-nums ${grupo.percent !== null && grupo.percent > 100 ? 'text-[#b3461a]' : 'text-emerald-800'}`}>{percentText(grupo.percent)}</strong>
                    <span className="mt-0.5 text-xs font-semibold text-slate-500">aplicado</span>
                  </span>
                  {podeEditar && (
                    <button type="button" onClick={() => abrirApontar(grupo.branchId)} className={`min-h-9 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700 active:scale-[0.98] ${focusRing}`}>
                      Apontar
                    </button>
                  )}
                </div>
              </header>
              <ul className="divide-y divide-slate-100">
                {grupo.rows.map(row => {
                  const material = catalogo.get(row.materialId);
                  const unidade = countUnit(material);
                  const chave = `${row.branchId}:${row.materialId}`;
                  const expandido = aberto === chave;
                  const acima = row.received > 0 && row.used > row.received;
                  const largura = row.percent === null ? 0 : Math.min(100, row.percent);
                  return (
                    <li key={chave}>
                      <button
                        type="button"
                        onClick={() => setAberto(expandido ? '' : chave)}
                        aria-expanded={expandido}
                        className={`grid w-full gap-1.5 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${focusRing}`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 text-sm font-bold text-slate-900">{row.materialDescription}</span>
                          <span className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums text-slate-700">
                            <strong className="text-slate-950">{number(inCountUnit(material, row.used))}</strong>
                            <span className="text-slate-400">de</span> {number(inCountUnit(material, row.received))} {unidade}
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                          </span>
                        </span>
                        <span
                          className="block h-1.5 overflow-hidden rounded-full bg-slate-100"
                          role="img"
                          aria-label={`${percentText(row.percent)} aplicado`}
                          title={`${formatMaterialQuantity(material, row.used, row.unit)} aplicados de ${formatMaterialQuantity(material, row.received, row.unit)}`}
                        >
                          <span className={`block h-full origin-left rounded-full transition-transform duration-500 ${acima ? 'bg-[#f26a2e]' : 'bg-emerald-700'}`} style={{ transform: `scaleX(${largura / 100})` }} />
                        </span>
                        <span className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-500">
                          <span className={acima ? 'font-bold text-[#b3461a]' : ''}>
                            {row.received === 0
                              ? 'Uso sem entrada neste ramo'
                              : acima
                                ? `${percentText(row.percent)} · ${number(inCountUnit(material, row.used - row.received))} ${unidade} acima do recebido`
                                : row.remaining === 0
                                  ? `${percentText(row.percent)} · tudo aplicado`
                                  : `${percentText(row.percent)} · faltam ${number(inCountUnit(material, row.remaining))} ${unidade}`}
                          </span>
                          <span>{row.lastUseDate ? `Último uso ${formatarData(row.lastUseDate)}${row.lastUseBy ? `, ${row.lastUseBy}` : ''}` : 'Nenhum uso apontado'}</span>
                        </span>
                      </button>
                      {expandido && (
                        <div className="bg-slate-50/70 px-4 pb-3 pt-1">
                          {usosDoMaterial(row).length === 0 ? (
                            <p className="py-2 text-xs text-slate-500">Nenhum uso apontado ainda.</p>
                          ) : (
                            <ul className="grid gap-1.5">
                              {usosDoMaterial(row).map(uso => (
                                <li key={uso.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs ${uso.canceladoEm ? 'opacity-60' : ''}`}>
                                  <span className="min-w-0">
                                    <strong className={`tabular-nums text-slate-900 ${uso.canceladoEm ? 'line-through' : ''}`}>{number(inCountUnit(material, uso.quantidade))} {unidade}</strong>
                                    <span className="text-slate-500"> · {formatarData(uso.data)} · {uso.apontadoPor || uso.responsavel}{uso.origemApontamentoId ? ' (link)' : ''}</span>
                                    {uso.canceladoEm && <span className="ml-1 font-bold text-slate-600">Desfeito por {uso.canceladoPor}</span>}
                                  </span>
                                  {podeEditar && !uso.canceladoEm && (confirmarDesfazer === uso.id ? (
                                    <span className="flex gap-1.5">
                                      <button type="button" onClick={() => desfazer(uso)} className={`inline-flex min-h-9 items-center gap-1 rounded-xl bg-[#b3461a] px-2.5 text-xs font-bold text-white ${focusRing}`}><Undo2 className="h-3.5 w-3.5" /> Confirmar</button>
                                      <button type="button" onClick={() => setConfirmarDesfazer('')} className={`min-h-9 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-600 ${focusRing}`}>Manter</button>
                                    </span>
                                  ) : (
                                    <button type="button" onClick={() => setConfirmarDesfazer(uso.id)} className={`inline-flex min-h-9 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:border-[#f26a2e] hover:text-[#b3461a] ${focusRing}`}>
                                      <RotateCcw className="h-3.5 w-3.5" /> Desfazer
                                    </button>
                                  ))}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(apontar)}
        onClose={() => setApontar(null)}
        title="Apontar uso"
        description="Escolha o ramo e marque o que foi aplicado. Tubo conta em peças."
        size="md"
        onSubmit={salvarApontamento}
        footer={(
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">{itensApontados.length ? `${itensApontados.length} material(is) marcado(s)` : 'Nada marcado'}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setApontar(null)} className={`min-h-11 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 ${focusRing}`}>Cancelar</button>
              <button type="button" onClick={salvarApontamento} disabled={itensApontados.length === 0} className={`min-h-11 rounded-xl bg-emerald-700 px-5 text-xs font-bold text-white hover:bg-emerald-800 active:scale-[0.98] disabled:bg-slate-300 ${focusRing}`}>Salvar uso</button>
            </div>
          </div>
        )}
      >
        {apontar && (
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-xs font-bold text-slate-600">
                Ramo
                <select
                  value={apontar.ramoId}
                  onChange={event => setApontar({ ...apontar, ramoId: event.target.value, quantidades: {} })}
                  className={`min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 ${focusRing}`}
                >
                  <option value="">Escolha o ramo</option>
                  {ramosComEntrada.map(ramo => <option key={ramo.branchId} value={ramo.branchId}>{ramo.branchName}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">
                Dia
                <input type="date" value={apontar.data} max={isoDay(new Date())} onChange={event => setApontar({ ...apontar, data: event.target.value || apontar.data })} className={`min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 ${focusRing}`} />
              </label>
            </div>
            {!ramoApontado ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Escolha o ramo para ver os materiais que chegaram lá.</p>
            ) : (
              <ul className="grid gap-2">
                {ramoApontado.rows.map(row => {
                  const material = catalogo.get(row.materialId);
                  const unidade = countUnit(material);
                  const valor = apontar.quantidades[row.materialId] || '';
                  const marcado = Number(valor.replace(',', '.')) || 0;
                  return (
                    <li key={row.materialId} className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${marcado > 0 ? 'border-emerald-600 bg-emerald-50/40' : 'border-slate-200'}`}>
                      <div className="min-w-0">
                        <strong className="block text-sm text-slate-900">{row.materialDescription}</strong>
                        <span className="text-xs text-slate-500">Sobram {number(inCountUnit(material, Math.max(0, row.remaining)))} de {number(inCountUnit(material, row.received))} {unidade}</span>
                      </div>
                      <div className="grid grid-cols-[44px_minmax(0,6rem)_44px] items-center gap-1.5">
                        <button type="button" aria-label={`Diminuir ${row.materialDescription}`} disabled={marcado <= 0} onClick={() => ajustarApontado(row.materialId, -1)} className={`grid h-11 place-items-center rounded-xl border border-slate-200 text-slate-700 disabled:opacity-40 ${focusRing}`}><Minus className="h-4 w-4" /></button>
                        <label className="flex h-11 items-baseline justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2">
                          <span className="sr-only">Quantidade de {row.materialDescription} em {unidade}</span>
                          <input
                            inputMode="decimal"
                            value={valor}
                            placeholder="0"
                            onFocus={event => event.target.select()}
                            onChange={event => {
                              const limpo = event.target.value.replace(/[^0-9,.]/g, '').slice(0, 9);
                              setApontar({ ...apontar, quantidades: { ...apontar.quantidades, [row.materialId]: limpo } });
                            }}
                            className="h-10 w-full min-w-0 bg-transparent text-right text-lg font-black tabular-nums text-slate-950 outline-none"
                          />
                          <small className="text-xs font-bold text-slate-500">{unidade}</small>
                        </label>
                        <button type="button" aria-label={`Aumentar ${row.materialDescription}`} onClick={() => ajustarApontado(row.materialId, 1)} className={`grid h-11 place-items-center rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 ${focusRing}`}><Plus className="h-4 w-4" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}

import { useState } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { isoDay } from '../../shared/ui/PeriodFilter';
import { baseTicketNumber, buildTicketNumberSequence, normalizeTicketNumber } from '../../utils/ticketNumberSequence';
import type { DestinoObraJazida, EmpresaTicketJazida, TicketJazida, TipoMaterialJazida, TipoTicketJazida } from '../../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from '../cadastros/estilos';
import { generateTicketBookPdf } from './documentoTicket';
import { EMPRESAS_TICKET, equipmentPlate, tipoDoTicket, type CadastrosDaJazida, type PrintedTicketBatch } from './constantes';

interface JanelaSequenciaProps {
  tickets: readonly TicketJazida[];
  cadastros: CadastrosDaJazida;
  materialOptions: readonly string[];
  destinationOptions: readonly string[];
  onReserveTicketNumbers: (count: number) => Promise<string[]>;
  onImportTickets: (items: TicketJazida[]) => void;
  /** O PDF saiu e as vias entraram na conferência. */
  onGerado: (lote: PrintedTicketBatch, dia: string, mensagem: string) => void;
  onFechar: () => void;
}

const formatSequentialNumber = (start: string, offset: number) => {
  const base = baseTicketNumber(start);
  if (!Number.isFinite(base)) return '';
  return normalizeTicketNumber(base + offset);
};

/**
 * Imprimir um bloco de tickets numerados em sequência (duas vias por folha).
 * Cada número já entra na conferência do dia como duas vias a devolver.
 */
export default function JanelaSequencia({
  tickets,
  cadastros,
  materialOptions,
  destinationOptions,
  onReserveTicketNumbers,
  onImportTickets,
  onGerado,
  onFechar,
}: JanelaSequenciaProps) {
  const { findEquipmentByPrefix, resolveDestinationIds, originLocationId } = cadastros;
  const [erro, setErro] = useState('');
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [batchStartNumber, setBatchStartNumber] = useState('');
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [batchStep, setBatchStep] = useState(10);
  const [batchNumberMode, setBatchNumberMode] = useState<'automatico' | 'manual'>('manual');
  const [batchDirection, setBatchDirection] = useState<'crescente' | 'decrescente'>('crescente');
  const [batchFillMode, setBatchFillMode] = useState<'em-branco' | 'pre-preenchido'>('em-branco');
  const [batchDate, setBatchDate] = useState(isoDay(new Date()));
  const [batchPrefixo, setBatchPrefixo] = useState('');
  const [batchPlaca, setBatchPlaca] = useState('');
  const [batchTipoMaterial, setBatchTipoMaterial] = useState<TipoMaterialJazida>('Solo');
  const [batchQuantidadeM3, setBatchQuantidadeM3] = useState<number>(1);
  const [batchDestinoObra, setBatchDestinoObra] = useState<DestinoObraJazida>('Marginal');
  const [batchEmpresa, setBatchEmpresa] = useState<EmpresaTicketJazida>('RENEA');

  const handleBatchPrefixChange = (value: string) => {
    const normalizedValue = value.toUpperCase();
    setBatchPrefixo(normalizedValue);
    const equipment = findEquipmentByPrefix(normalizedValue);
    if (equipment) {
      setBatchPrefixo(equipment.prefixo.toUpperCase());
      setBatchPlaca(equipmentPlate(equipment));
    } else {
      setBatchPlaca('');
    }
  };

  const buildBatchTicket = (number: string, type: TipoTicketJazida, batchId: string, createdAt: string): TicketJazida => {
    const blank = batchFillMode === 'em-branco';
    const selectedEquipment = findEquipmentByPrefix(batchPrefixo);
    const destinationIds = resolveDestinationIds(batchDestinoObra);
    return {
      id: `ticket-lote-${type === 'Liberação' ? 'lib' : 'rec'}-${number}-${Date.now()}`,
      data: batchDate,
      tipoTicket: type,
      ticketNumero: number,
      prefixo: blank ? '' : batchPrefixo.trim().toUpperCase(),
      placa: blank ? '' : batchPlaca.trim().toUpperCase(),
      familiaEquipamento: blank ? '' : selectedEquipment?.tipo || '',
      equipamentoNome: blank ? '' : selectedEquipment?.nome || '',
      horaSaida: '',
      horaChegada: '',
      tipoMaterial: blank ? '' as TipoMaterialJazida : batchTipoMaterial,
      quantidadeM3: blank ? 0 : Number(batchQuantidadeM3) || 0,
      destinoObra: blank ? '' as DestinoObraJazida : batchDestinoObra,
      destinoOutro: '',
      responsavelLiberacao: '',
      nomeLegivel: '',
      empresa: blank ? '' as EmpresaTicketJazida : batchEmpresa,
      estaca: '',
      observacao: '',
      unidadeQuantidade: 'm³',
      status: 'Pendente',
      statusFluxo: 'Rascunho',
      origemRegistro: 'Admin',
      criadoEm: createdAt,
      atualizadoEm: createdAt,
      impressaoEmBranco: blank,
      ocultarNumeroImpressao: false,
      loteImpressaoId: batchId,
      loteImpressaoCriadoEm: createdAt,
      equipamentoId: blank ? undefined : selectedEquipment?.id,
      localOrigemId: blank ? undefined : originLocationId,
      localDestinoId: blank ? undefined : destinationIds.localDestinoId,
    };
  };

  const handleGenerateBatchTickets = async () => {
    setErro('');
    const quantity = Math.max(1, Math.min(200, Math.floor(Number(batchQuantity) || 0)));
    const step = Math.max(1, Math.floor(Number(batchStep) || 1));
    if (batchNumberMode === 'manual' && !batchStartNumber.trim()) {
      setErro('Informe o primeiro número da sequência.');
      return;
    }
    if (!batchDate) {
      setErro('Informe o dia da conferência.');
      return;
    }

    setIsBatchPrinting(true);
    try {
      const reserved = batchNumberMode === 'automatico'
        ? await onReserveTicketNumbers(quantity)
        : buildTicketNumberSequence(batchStartNumber, quantity, step, batchDirection);
      const numbers = reserved.filter(Boolean);
      if (numbers.length !== quantity) throw new Error('Faixa de numeração inválida.');
      const batchId = `lote-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const pairs = numbers.map(number => ({
        releaseTicket: buildBatchTicket(number, 'Liberação', batchId, createdAt),
        receiptTicket: buildBatchTicket(number, 'Recebimento', batchId, createdAt),
      }));
      const fileMode = batchFillMode === 'em-branco' ? 'em_branco' : 'pre_preenchidos';
      await generateTicketBookPdf(pairs, `tickets_${fileMode}_${numbers[0]}_${numbers[numbers.length - 1]}.pdf`);

      const existingKeys = new Set(tickets.map(ticket =>
        `${normalizeTicketNumber(ticket.ticketNumero)}|${tipoDoTicket(ticket)}`
      ));
      const drafts = pairs.flatMap(pair => [pair.releaseTicket, pair.receiptTicket]);
      const collisionCount = drafts.filter(ticket => existingKeys.has(`${ticket.ticketNumero}|${tipoDoTicket(ticket)}`)).length;
      onImportTickets(drafts);

      const bases = numbers.map(baseTicketNumber).filter(Number.isFinite);
      onGerado({
        id: batchId,
        inicio: Math.min(...bases),
        fim: Math.max(...bases),
        numeros: numbers,
        modo: batchFillMode === 'em-branco' ? 'Em branco' : 'Pré-preenchido',
        criadoEm: createdAt,
      }, batchDate, `${numbers.length} ticket(s) impressos em duas vias. Eles já estão na conferência do dia, esperando as vias voltarem.${collisionCount ? ` ${collisionCount} via(s) com número repetido foram guardadas e marcadas para conferir.` : ''}`);
    } catch (err) {
      console.error('Erro ao gerar tickets sequenciais:', err);
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar o PDF da sequência.');
    } finally {
      setIsBatchPrinting(false);
    }
  };

  const automatico = batchNumberMode === 'automatico';
  const emBranco = batchFillMode === 'em-branco';
  const quantidadeValida = Math.max(1, Math.min(200, Number(batchQuantity) || 1));
  const passo = Math.max(1, Number(batchStep) || 1);
  const ultimo = (batchDirection === 'crescente' ? 1 : -1) * passo * (quantidadeValida - 1);
  const opcao = (ativa: boolean) => `flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ${ativa ? 'border-[#176b4d] bg-emerald-50' : 'border-slate-200 bg-white'}`;

  return (
    <Modal
      open
      size="lg"
      busy={isBatchPrinting}
      title="Imprimir tickets em sequência"
      description="Sai um PDF com as duas vias de cada número. Os números entram na conferência do dia esperando as vias voltarem."
      onClose={onFechar}
      footer={(
        <div className="space-y-3">
          {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{erro}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onFechar} disabled={isBatchPrinting} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={() => void handleGenerateBatchTickets()} disabled={isBatchPrinting} className={BOTAO_PRIMARIO} data-testid="jazida-gerar-sequencia">
              {isBatchPrinting ? 'Gerando PDF…' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className={`${ROTULO} mb-2`}>O que sai impresso</legend>
          <label className={opcao(emBranco)}>
            <input type="radio" name="batch-fill-mode" checked={emBranco} onChange={() => setBatchFillMode('em-branco')} className="mt-0.5 size-5 accent-[#176b4d]" />
            <span><b className="block text-sm text-slate-900">Só o número</b><span className="block text-sm text-slate-600">O resto é preenchido à caneta.</span></span>
          </label>
          <label className={opcao(!emBranco)}>
            <input type="radio" name="batch-fill-mode" checked={!emBranco} onChange={() => setBatchFillMode('pre-preenchido')} className="mt-0.5 size-5 accent-[#176b4d]" />
            <span><b className="block text-sm text-slate-900">Número e dados do caminhão</b><span className="block text-sm text-slate-600">Escolha abaixo o que já sai escrito.</span></span>
          </label>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-1.5"><span className={ROTULO}>Numeração</span>
            <select value={batchNumberMode} onChange={e => setBatchNumberMode(e.target.value as 'automatico' | 'manual')} className={CAMPO}>
              <option value="manual">Eu digito o primeiro número</option>
              <option value="automatico">Continuar de onde parou</option>
            </select>
          </label>
          <label className="block space-y-1.5"><span className={ROTULO}>Quantos tickets</span>
            <input type="number" min="1" max="200" inputMode="numeric" value={batchQuantity} onChange={e => setBatchQuantity(Number(e.target.value))} className={CAMPO} />
          </label>
          <label className="block space-y-1.5"><span className={ROTULO}>Dia da conferência</span>
            <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)} className={CAMPO} />
          </label>
          {!automatico && <>
            <label className="block space-y-1.5"><span className={ROTULO}>Primeiro número</span>
              <input value={batchStartNumber} onChange={e => setBatchStartNumber(e.target.value)} inputMode="numeric" placeholder="Ex.: 100310" className={CAMPO} />
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Ordem</span>
              <select value={batchDirection} onChange={e => setBatchDirection(e.target.value as 'crescente' | 'decrescente')} className={CAMPO}>
                <option value="crescente">Crescente</option>
                <option value="decrescente">Decrescente</option>
              </select>
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Pular de quanto em quanto</span>
              <input type="number" min="1" max="1000" inputMode="numeric" value={batchStep} onChange={e => setBatchStep(Number(e.target.value))} className={CAMPO} />
            </label>
          </>}
          {!emBranco && <>
            <label className="block space-y-1.5"><span className={ROTULO}>Prefixo do caminhão</span>
              <input list="ticket-equipment-prefixes" value={batchPrefixo} onChange={e => handleBatchPrefixChange(e.target.value)} className={CAMPO} placeholder="Digite ou escolha" />
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Placa</span>
              <input value={batchPlaca} onChange={e => setBatchPlaca(e.target.value.toUpperCase())} className={CAMPO} />
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Quantidade (m³)</span>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={batchQuantidadeM3} onChange={e => setBatchQuantidadeM3(Number(e.target.value))} className={CAMPO} />
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Material</span>
              <select value={batchTipoMaterial} onChange={e => setBatchTipoMaterial(e.target.value as TipoMaterialJazida)} className={CAMPO}>
                {materialOptions.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Destino na obra</span>
              <select value={batchDestinoObra} onChange={e => setBatchDestinoObra(e.target.value as DestinoObraJazida)} className={CAMPO}>
                {destinationOptions.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5"><span className={ROTULO}>Empresa</span>
              <select value={batchEmpresa} onChange={e => setBatchEmpresa(e.target.value as EmpresaTicketJazida)} className={CAMPO}>
                {EMPRESAS_TICKET.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </>}
        </div>

        <p className="rounded-xl bg-[#f7f8f6] p-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200" aria-live="polite">
          <b className="text-slate-900">Vai sair:</b>{' '}
          {quantidadeValida} ticket(s) em duas vias, {emBranco ? 'só com o número' : 'com os dados escolhidos'}.
          {automatico
            ? ' Os números continuam de onde a última impressão parou.'
            : ` Do ${batchStartNumber ? formatSequentialNumber(batchStartNumber, 0) : '…'} ao ${batchStartNumber ? formatSequentialNumber(batchStartNumber, ultimo) : '…'}, de ${passo} em ${passo}.`}
        </p>
      </div>
    </Modal>
  );
}

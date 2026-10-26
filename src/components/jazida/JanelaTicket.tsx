import React, { useMemo, useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { Modal } from '../../shared/ui/Modal';
import { isoDay } from '../../shared/ui/PeriodFilter';
import { normalizeTicketNumber } from '../../utils/ticketNumberSequence';
import type {
  ControleEquipamentoDiario,
  DestinoObraJazida,
  EmpresaTicketJazida,
  Equipamento,
  TicketJazida,
  TipoMaterialJazida,
  TipoTicketJazida,
} from '../../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, FOCO, ROTULO } from '../cadastros/estilos';
import { EMPRESAS_TICKET, equipmentPlate, tipoDoTicket, type CadastrosDaJazida } from './constantes';

interface JanelaTicketProps {
  /** Ticket em edição; null abre um novo. */
  ticket: TicketJazida | null;
  /** Via de um ticket novo (a que a lista mostra no momento). */
  tipoInicial: TipoTicketJazida;
  tickets: readonly TicketJazida[];
  cadastros: CadastrosDaJazida;
  materialOptions: readonly string[];
  destinationOptions: readonly string[];
  controlesEquipamentos: readonly ControleEquipamentoDiario[];
  onSalvar: (ticket: TicketJazida, isNew: boolean, mensagem: string) => void;
  onFechar: () => void;
}

const ID_FORMULARIO = 'jazida-formulario-ticket';
const horaAgora = () => new Date().toTimeString().split(' ')[0].substring(0, 5);

/**
 * Lançar ou corrigir um ticket. Dois jeitos de salvar: rascunho (só número e
 * data, a via não conta como devolvida) e concluir (confere os campos e conta
 * a via como devolvida na conferência do dia).
 */
export default function JanelaTicket({
  ticket,
  tipoInicial,
  tickets,
  cadastros,
  materialOptions,
  destinationOptions,
  controlesEquipamentos,
  onSalvar,
  onFechar,
}: JanelaTicketProps) {
  const { findEquipmentByPrefix, resolveDestinationIds, originLocationId } = cadastros;
  const editingId = ticket?.id ?? null;
  const cadastrado = ticket ? findEquipmentByPrefix(ticket.prefixo) : undefined;

  const [validationError, setValidationError] = useState('');
  const [tipoTicket, setTipoTicket] = useState<TipoTicketJazida>(ticket ? tipoDoTicket(ticket) : tipoInicial);
  const [data, setData] = useState(ticket?.data ?? isoDay(new Date()));
  const [ticketNumero, setTicketNumero] = useState(ticket?.ticketNumero ?? '');
  const [prefixo, setPrefixo] = useState(ticket?.prefixo ?? '');
  const [placa, setPlaca] = useState(ticket ? ticket.placa || (cadastrado ? equipmentPlate(cadastrado) : '') : '');
  const [familiaEquipamento, setFamiliaEquipamento] = useState(ticket ? ticket.familiaEquipamento || cadastrado?.tipo || '' : '');
  const [equipamentoNome, setEquipamentoNome] = useState(ticket ? ticket.equipamentoNome || cadastrado?.nome || '' : '');
  const [horaChegada, setHoraChegada] = useState(ticket ? ticket.horaChegada || ticket.horaSaida : horaAgora());
  const [horaSaida, setHoraSaida] = useState(ticket?.horaSaida ?? horaAgora());
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterialJazida>(ticket?.tipoMaterial ?? 'Solo');
  const [quantidadeM3, setQuantidadeM3] = useState<number>(ticket?.quantidadeM3 ?? 1);
  const [destinoObra, setDestinoObra] = useState<DestinoObraJazida>(ticket?.destinoObra ?? 'Marginal');
  const [destinoOutro, setDestinoOutro] = useState(ticket?.destinoOutro ?? '');
  const [responsavelLiberacao, setResponsavelLiberacao] = useState(ticket?.responsavelLiberacao ?? '');
  const [nomeLegivel, setNomeLegivel] = useState(ticket?.nomeLegivel ?? '');
  const [motoristaNome, setMotoristaNome] = useState(ticket?.motoristaNome ?? '');
  const [materialOutro, setMaterialOutro] = useState(ticket?.materialOutro ?? '');
  const [empresa, setEmpresa] = useState<EmpresaTicketJazida>(ticket?.empresa ?? 'RENEA');
  const [estaca, setEstaca] = useState(ticket?.estaca ?? '');
  const [observacao, setObservacao] = useState(ticket?.observacao ?? '');
  const [notaFiscalNumero, setNotaFiscalNumero] = useState(ticket?.notaFiscalNumero ?? '');
  const [notaFiscalData, setNotaFiscalData] = useState(ticket?.notaFiscalData ?? '');
  const [notaFiscalObservacao, setNotaFiscalObservacao] = useState(ticket?.notaFiscalObservacao ?? '');
  const [advancedFormOpen, setAdvancedFormOpen] = useState(Boolean(ticket && (ticket.observacao || ticket.notaFiscalNumero || ticket.notaFiscalData || ticket.notaFiscalObservacao)));

  // O controle diário já sabe quem estava no prefixo naquele dia: sugerir evita
  // digitar de novo, e o campo continua editável para motorista substituto.
  const motoristaSugerido = useMemo(() => {
    const alvo = prefixo.trim().toLocaleUpperCase('pt-BR');
    if (!alvo) return '';
    return controlesEquipamentos.find(item => item.data === data
      && item.prefixo.trim().toLocaleUpperCase('pt-BR') === alvo)?.nomeMotorista?.trim() || '';
  }, [controlesEquipamentos, prefixo, data]);

  const fillEquipmentFields = (equipment?: Equipamento) => {
    if (!equipment) return false;
    setPrefixo(equipment.prefixo.toUpperCase());
    setPlaca(equipmentPlate(equipment));
    setFamiliaEquipamento(equipment.tipo || '');
    setEquipamentoNome(equipment.nome || '');
    return true;
  };

  const handlePrefixChange = (value: string) => {
    const normalizedValue = value.toUpperCase();
    setPrefixo(normalizedValue);
    const equipment = findEquipmentByPrefix(normalizedValue);
    if (equipment) fillEquipmentFields(equipment);
    else {
      setPlaca('');
      setFamiliaEquipamento('');
      setEquipamentoNome('');
    }
  };

  // Recebimento com o número de uma liberação já lançada puxa caminhão, placa,
  // material, quantidade e empresa dela.
  const applyLiberacaoCloneToForm = (numero: string, force = false) => {
    const liberacao = tickets.find(t =>
      tipoDoTicket(t) === 'Liberação' &&
      normalizeTicketNumber(t.ticketNumero) === normalizeTicketNumber(numero)
    );
    if (!liberacao) return false;
    const registeredEquipment = findEquipmentByPrefix(liberacao.prefixo);

    if (force || !prefixo.trim()) setPrefixo(liberacao.prefixo);
    if (force || !placa.trim()) setPlaca(liberacao.placa || (registeredEquipment ? equipmentPlate(registeredEquipment) : ''));
    if (force || !familiaEquipamento.trim()) setFamiliaEquipamento(liberacao.familiaEquipamento || registeredEquipment?.tipo || '');
    if (force || !equipamentoNome.trim()) setEquipamentoNome(liberacao.equipamentoNome || registeredEquipment?.nome || '');
    if (force || quantidadeM3 <= 1) setQuantidadeM3(liberacao.quantidadeM3 || 1);
    if (force || tipoMaterial === 'Solo') setTipoMaterial(liberacao.tipoMaterial);
    if (force || empresa === 'RENEA') setEmpresa(liberacao.empresa);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const saveMode = submitter?.value === 'draft' ? 'draft' : 'complete';

    if (!ticketNumero.trim()) { setValidationError('Informe o número do ticket.'); return; }
    if (!data) { setValidationError('Informe a data.'); return; }
    if (saveMode === 'complete') {
      if (!prefixo.trim()) { setValidationError('Para concluir, informe o prefixo do caminhão. Se ainda não souber, use “Salvar rascunho”.'); return; }
      if (!placa.trim()) { setValidationError('Para concluir, informe a placa. Se ainda não souber, use “Salvar rascunho”.'); return; }
      if (tipoTicket === 'Recebimento' && !horaChegada) { setValidationError('Para concluir, informe a hora de chegada.'); return; }
      if (tipoTicket === 'Liberação' && !horaSaida) { setValidationError('Para concluir, informe a hora de saída.'); return; }
      if (!tipoMaterial) { setValidationError('Para concluir, escolha o material.'); return; }
      if (!quantidadeM3 || quantidadeM3 <= 0) { setValidationError('Para concluir, a quantidade deve ser maior que zero.'); return; }
      if (destinoObra === 'Outros' && !destinoOutro.trim()) { setValidationError('Para concluir, informe o destino ou ramo de descarga.'); return; }
    }

    const normalizedTicketNumber = normalizeTicketNumber(ticketNumero);
    if (!normalizedTicketNumber) { setValidationError('Informe um número de ticket válido.'); return; }

    const duplicado = tickets.some(t =>
      normalizeTicketNumber(t.ticketNumero) === normalizedTicketNumber &&
      tipoDoTicket(t) === tipoTicket &&
      t.id !== editingId
    );
    if (duplicado) { setValidationError(`Já existe um ticket de ${tipoTicket.toLowerCase()} com esse número. O número não pode se repetir na mesma via.`); return; }

    const isNew = editingId === null;
    const now = new Date().toISOString();
    const existing = !isNew ? tickets.find(t => t.id === editingId) : undefined;
    const selectedEquipment = findEquipmentByPrefix(prefixo);
    const destinationLabel = destinoObra === 'Outros' ? destinoOutro.trim() : destinoObra;
    const destinationIds = resolveDestinationIds(destinationLabel);

    onSalvar({
      ...(existing || {}),
      id: isNew ? `ticket-${Date.now()}` : editingId!,
      data,
      tipoTicket,
      ticketNumero: normalizedTicketNumber,
      prefixo: prefixo.trim(),
      placa: placa.trim().toUpperCase(),
      familiaEquipamento: familiaEquipamento.trim(),
      equipamentoNome: equipamentoNome.trim(),
      horaChegada: tipoTicket === 'Recebimento' ? horaChegada : existing?.horaChegada,
      horaSaida: tipoTicket === 'Liberação' ? horaSaida : (horaChegada || horaSaida),
      tipoMaterial,
      materialOutro: tipoMaterial === 'Outros' ? materialOutro.trim() : undefined,
      quantidadeM3: Number(quantidadeM3),
      destinoObra,
      destinoOutro: destinoOutro.trim(),
      estaca: estaca.trim(),
      responsavelLiberacao: responsavelLiberacao.trim(),
      nomeLegivel: nomeLegivel.trim(),
      motoristaNome: motoristaNome.trim() || undefined,
      empresa,
      observacao: observacao.trim(),
      status: saveMode === 'draft' ? 'Pendente' : 'OK',
      statusFluxo: saveMode === 'draft' ? 'Rascunho' : 'Enviado',
      unidadeQuantidade: existing?.unidadeQuantidade || 'm³',
      origemRegistro: existing?.origemRegistro || 'Admin',
      enviadoEm: saveMode === 'draft' ? undefined : existing?.enviadoEm || now,
      criadoEm: existing?.criadoEm || now,
      atualizadoEm: now,
      devolvidoEm: saveMode === 'draft' ? undefined : existing?.devolvidoEm || now,
      conferidoPor: saveMode === 'draft' ? undefined : existing?.conferidoPor || 'Admin',
      notaFiscalNumero: notaFiscalNumero.trim(),
      notaFiscalData,
      notaFiscalObservacao: notaFiscalObservacao.trim(),
      impressaoEmBranco: false,
      ocultarNumeroImpressao: false,
      equipamentoId: selectedEquipment?.id || existing?.equipamentoId,
      localOrigemId: originLocationId || existing?.localOrigemId,
      localDestinoId: destinationIds.localDestinoId || existing?.localDestinoId,
    }, isNew, saveMode === 'draft'
      ? `Ticket ${normalizedTicketNumber} guardado como rascunho. Dá para continuar depois sem perder nada.`
      : `Ticket ${normalizedTicketNumber} concluído: a via conta como devolvida.`);
  };

  const recebimento = tipoTicket === 'Recebimento';
  const campo = (rotulo: string, controle: React.ReactNode, extra?: React.ReactNode) => (
    <label className="block space-y-1.5">
      <span className={ROTULO}>{rotulo}</span>
      {controle}
      {extra}
    </label>
  );

  return (
    <Modal
      open
      size="lg"
      title={editingId ? `Corrigir ticket ${ticket?.ticketNumero}` : 'Novo ticket'}
      description="Preencha o que já sabe. Campos com * são pedidos só para concluir."
      onClose={onFechar}
      footer={(
        <div className="space-y-3">
          {validationError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{validationError}</p>}
          <p className="text-sm text-slate-600"><b className="text-slate-800">Rascunho</b> guarda sem contar a via como devolvida. <b className="text-slate-800">Concluir</b> confere os campos e conta a via como devolvida.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="submit" form={ID_FORMULARIO} name="saveMode" value="draft" className={BOTAO_SECUNDARIO} data-testid="jazida-salvar-rascunho">Salvar rascunho</button>
            <button type="submit" form={ID_FORMULARIO} name="saveMode" value="complete" className={BOTAO_PRIMARIO} data-testid="jazida-concluir">
              {editingId ? 'Concluir e salvar' : 'Concluir lançamento'}
            </button>
          </div>
        </div>
      )}
    >
      <form id={ID_FORMULARIO} onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campo('Via *', (
            <select value={tipoTicket} onChange={e => {
              const nextTipo = e.target.value as TipoTicketJazida;
              setTipoTicket(nextTipo);
              if (nextTipo === 'Recebimento' && ticketNumero.trim()) applyLiberacaoCloneToForm(ticketNumero);
            }} className={CAMPO}>
              <option value="Liberação">Liberação (saída da jazida)</option>
              <option value="Recebimento">Recebimento (chegada na obra)</option>
            </select>
          ))}
          {campo('Número do ticket *', (
            <input
              type="text"
              inputMode="numeric"
              value={ticketNumero}
              onChange={e => setTicketNumero(e.target.value)}
              onBlur={() => { if (tipoTicket === 'Recebimento' && ticketNumero.trim()) applyLiberacaoCloneToForm(ticketNumero); }}
              className={CAMPO}
            />
          ), recebimento ? <span className="block text-xs text-slate-600">Com o número da liberação, o caminhão e a carga vêm preenchidos.</span> : undefined)}
          {campo('Data *', <input type="date" value={data} onChange={e => setData(e.target.value)} className={CAMPO} />)}
          {recebimento
            ? campo('Hora de chegada *', <input type="time" value={horaChegada} onChange={e => setHoraChegada(e.target.value)} className={CAMPO} />)
            : campo('Hora de saída *', <input type="time" value={horaSaida} onChange={e => setHoraSaida(e.target.value)} className={CAMPO} />)}
          {campo('Prefixo do caminhão *', <input type="text" list="ticket-equipment-prefixes" value={prefixo} onChange={e => handlePrefixChange(e.target.value)} onBlur={() => fillEquipmentFields(findEquipmentByPrefix(prefixo))} className={CAMPO} placeholder="Digite ou escolha" />)}
          {campo('Placa *', <input type="text" value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} className={CAMPO} />)}
          {campo('Tipo do equipamento', <input type="text" value={familiaEquipamento} onChange={e => setFamiliaEquipamento(e.target.value)} className={CAMPO} placeholder="Vem do cadastro" />)}
          {campo('Equipamento', <input type="text" value={equipamentoNome} onChange={e => setEquipamentoNome(e.target.value)} className={CAMPO} placeholder="Vem do cadastro" />)}
          {campo('Motorista', <input type="text" value={motoristaNome} onChange={e => setMotoristaNome(e.target.value)} placeholder={motoristaSugerido || 'Quem fez a viagem'} className={CAMPO} />, motoristaSugerido && !motoristaNome ? (
            <button type="button" onClick={() => setMotoristaNome(motoristaSugerido)} className={`min-h-9 rounded-lg px-1 text-left text-sm font-semibold text-[#176b4d] hover:underline ${FOCO}`}>
              Usar {motoristaSugerido} (controle do dia)
            </button>
          ) : undefined)}
          {campo('Material *', (
            <select value={tipoMaterial} onChange={e => setTipoMaterial(e.target.value as TipoMaterialJazida)} className={CAMPO}>
              {materialOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ), tipoMaterial === 'Outros' ? (
            <input type="text" aria-label="Qual material?" value={materialOutro} onChange={e => setMaterialOutro(e.target.value)} placeholder="Qual material?" className={CAMPO} />
          ) : undefined)}
          {campo('Quantidade (m³) *', <input type="number" min="0" step="0.01" inputMode="decimal" value={quantidadeM3} onChange={e => setQuantidadeM3(Number(e.target.value))} className={CAMPO} />)}
          {campo(recebimento ? 'Ramo de descarga *' : 'Destino na obra *', (
            <select value={destinoObra} onChange={e => setDestinoObra(e.target.value as DestinoObraJazida)} className={CAMPO}>
              {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          ))}
          {destinoObra === 'Outros' && campo(recebimento ? 'Qual ramo de descarga? *' : 'Qual destino? *', <input type="text" value={destinoOutro} onChange={e => setDestinoOutro(e.target.value)} className={CAMPO} />)}
          {recebimento && campo('Estaca', <input type="text" value={estaca} onChange={e => setEstaca(e.target.value)} className={CAMPO} placeholder="Ex.: 120+10" />)}
          {campo('Empresa *', (
            <select value={empresa} onChange={e => setEmpresa(e.target.value as EmpresaTicketJazida)} className={CAMPO}>
              {EMPRESAS_TICKET.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
          ))}
          {campo('Quem liberou', <input type="text" value={responsavelLiberacao} onChange={e => setResponsavelLiberacao(e.target.value)} className={CAMPO} />)}
          {campo('Nome legível de quem assinou', <input type="text" value={nomeLegivel} onChange={e => setNomeLegivel(e.target.value)} className={CAMPO} />)}
        </div>

        <button
          type="button"
          onClick={() => setAdvancedFormOpen(value => !value)}
          aria-expanded={advancedFormOpen}
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-left hover:border-emerald-500 ${FOCO}`}
        >
          <span>
            <b className="block text-sm font-bold text-slate-800">Observação e nota fiscal</b>
            <span className="block text-sm text-slate-600">Só se precisar.</span>
          </span>
          <ChevronDown className={`size-5 shrink-0 text-slate-500 transition-transform ${advancedFormOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {advancedFormOpen && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-[#f7f8f6] p-4">
            {campo('Observação', <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} className={CAMPO} />)}
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="size-4 text-[#176b4d]" aria-hidden="true" /> Nota fiscal</p>
            <div className="grid gap-3 md:grid-cols-[1fr_12rem_2fr]">
              {campo('Número da nota', <input type="text" value={notaFiscalNumero} onChange={event => setNotaFiscalNumero(event.target.value)} className={CAMPO} placeholder="Ex.: NF 15482" />)}
              {campo('Data da nota', <input type="date" value={notaFiscalData} onChange={event => setNotaFiscalData(event.target.value)} className={CAMPO} />)}
              {campo('Observação da nota', <input type="text" value={notaFiscalObservacao} onChange={event => setNotaFiscalObservacao(event.target.value)} className={CAMPO} placeholder="Fornecedor ou diferença na carga" />)}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

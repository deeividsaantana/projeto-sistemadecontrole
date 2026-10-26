import { useState } from 'react';
import { Modal } from '../../shared/ui/Modal';
import type { JazidaDailyControlRow } from '../../utils/jazidaDailyControl';
import type { TicketJazida } from '../../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from '../cadastros/estilos';

interface JanelaNotaProps {
  linha: JazidaDailyControlRow;
  onImportTickets: (items: TicketJazida[]) => void;
  onSalvo: (mensagem: string) => void;
  onFechar: () => void;
}

/** Nota fiscal de um ticket: grava igual nas duas vias, sem mexer na devolução. */
export default function JanelaNota({ linha, onImportTickets, onSalvo, onFechar }: JanelaNotaProps) {
  const source = linha.recebimento || linha.liberacao;
  const [notaFiscalNumero, setNotaFiscalNumero] = useState(source?.notaFiscalNumero || '');
  const [notaFiscalData, setNotaFiscalData] = useState(source?.notaFiscalData || '');
  const [notaFiscalObservacao, setNotaFiscalObservacao] = useState(source?.notaFiscalObservacao || '');

  const salvar = () => {
    const now = new Date().toISOString();
    const updates = [linha.liberacao, linha.recebimento]
      .filter((ticket): ticket is TicketJazida => Boolean(ticket))
      .map(ticket => ({
        ...ticket,
        notaFiscalNumero: notaFiscalNumero.trim(),
        notaFiscalData,
        notaFiscalObservacao: notaFiscalObservacao.trim(),
        atualizadoEm: now,
      }));
    if (updates.length) onImportTickets(updates);
    onSalvo(`Nota do ticket ${linha.numero} gravada nas duas vias.`);
  };

  return (
    <Modal
      open
      size="md"
      title={`Nota fiscal do ticket ${linha.numero}`}
      description="Vale para as duas vias. Não muda a devolução."
      onClose={onFechar}
      onSubmit={salvar}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={salvar} className={BOTAO_PRIMARIO} data-testid="jazida-salvar-nota">Salvar nas duas vias</button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5"><span className={ROTULO}>Número da nota</span><input type="text" value={notaFiscalNumero} onChange={event => setNotaFiscalNumero(event.target.value)} className={CAMPO} /></label>
          <label className="block space-y-1.5"><span className={ROTULO}>Data da nota</span><input type="date" value={notaFiscalData} onChange={event => setNotaFiscalData(event.target.value)} className={CAMPO} /></label>
        </div>
        <label className="block space-y-1.5"><span className={ROTULO}>Observação da nota</span><textarea rows={3} value={notaFiscalObservacao} onChange={event => setNotaFiscalObservacao(event.target.value)} className={`${CAMPO} resize-y py-2`} /></label>
      </div>
    </Modal>
  );
}

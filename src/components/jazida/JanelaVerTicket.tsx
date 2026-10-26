import { Printer } from 'lucide-react';
import { Modal } from '../../shared/ui/Modal';
import type { TicketJazida } from '../../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO } from '../cadastros/estilos';
import { TicketDocumentPreview } from './documentoTicket';

interface JanelaVerTicketProps {
  numero: string;
  releaseTicket: TicketJazida;
  receiptTicket: TicketJazida;
  onImprimir: () => void;
  onFechar: () => void;
}

/** Como a folha do ticket vai sair na impressora: as duas vias e a linha de corte. */
export default function JanelaVerTicket({ numero, releaseTicket, receiptTicket, onImprimir, onFechar }: JanelaVerTicketProps) {
  return (
    <Modal
      open
      size="xl"
      title={`Ticket ${numero}`}
      description="Folha com as duas vias, do jeito que sai na impressora."
      onClose={onFechar}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Fechar</button>
          <button type="button" onClick={onImprimir} className={BOTAO_PRIMARIO}><Printer className="size-5" aria-hidden="true" /> Imprimir ou salvar PDF</button>
        </div>
      )}
    >
      <div role="region" aria-label={`Folha do ticket ${numero}`} tabIndex={0} className={`overflow-auto rounded-xl bg-[#f7f8f6] p-3 ${FOCO}`}>
        <TicketDocumentPreview releaseTicket={releaseTicket} receiptTicket={receiptTicket} />
      </div>
    </Modal>
  );
}

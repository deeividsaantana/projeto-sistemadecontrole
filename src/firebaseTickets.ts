import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import { TicketJazida } from './types';

const CLOUD_COLLECTION = 'sistemarenea_cloud';
const COUNTER_DOCUMENT_ID = 'ticket_counter';
const TICKET_DOCUMENT_PREFIX = 'ticket_public_';

const safeDocumentId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);

// O Firestore rejeita propriedades com valor undefined. A serialização mantém
// os dados válidos do ticket e remove somente campos opcionais ainda vazios.
const sanitizeForFirestore = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const nextNumberFromTickets = (tickets: TicketJazida[]) => {
  const highest = tickets.reduce((max, ticket) => {
    const numeric = Number.parseInt(String(ticket.ticketNumero).replace(/\D/g, ''), 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return highest + 1;
};

export const reservePublicTicketNumber = async (
  database: Firestore,
  knownTickets: TicketJazida[],
): Promise<string> => {
  const counterRef = doc(database, CLOUD_COLLECTION, COUNTER_DOCUMENT_ID);
  return runTransaction(database, async transaction => {
    const counterSnapshot = await transaction.get(counterRef);
    const storedNext = Number(counterSnapshot.data()?.value?.nextNumber || 0);
    const nextNumber = Math.max(storedNext, nextNumberFromTickets(knownTickets), 1);

    transaction.set(counterRef, {
      updatedAt: new Date().toISOString(),
      kind: 'ticket_counter',
      value: { nextNumber: nextNumber + 1 },
    });

    return String(nextNumber);
  });
};

export const savePublicTicket = async (
  database: Firestore,
  ticket: TicketJazida,
  options: { allowOverwriteSent?: boolean } = {},
) => {
  const ticketRef = doc(
    database,
    CLOUD_COLLECTION,
    `${TICKET_DOCUMENT_PREFIX}${safeDocumentId(ticket.id)}`,
  );
  const firestorePayload = {
    updatedAt: new Date().toISOString(),
    kind: 'ticket_public',
    value: sanitizeForFirestore(ticket),
  };

  if (
    ticket.tipoTicket === 'Recebimento'
    && ticket.statusFluxo === 'Enviado'
    && !options.allowOverwriteSent
  ) {
    await runTransaction(database, async transaction => {
      const current = await transaction.get(ticketRef);
      const currentTicket = current.data()?.value as TicketJazida | undefined;
      if (currentTicket?.statusFluxo === 'Enviado') {
        throw new Error(`O recebimento do Ticket ${ticket.ticketNumero} já foi enviado por outra pessoa.`);
      }
      transaction.set(ticketRef, firestorePayload);
    });
    return;
  }

  await setDoc(ticketRef, firestorePayload);
};

export const deletePublicTicket = async (database: Firestore, ticketId: string) => {
  await deleteDoc(doc(
    database,
    CLOUD_COLLECTION,
    `${TICKET_DOCUMENT_PREFIX}${safeDocumentId(ticketId)}`,
  ));
};

export const loadPublicTickets = async (database: Firestore): Promise<TicketJazida[]> => {
  const snapshot = await getDocs(query(
    collection(database, CLOUD_COLLECTION),
    where('kind', '==', 'ticket_public'),
  ));
  return snapshot.docs
    .filter(item => item.id.startsWith(TICKET_DOCUMENT_PREFIX))
    .map(item => item.data().value as TicketJazida)
    .filter(item => item && typeof item.id === 'string' && typeof item.ticketNumero === 'string');
};

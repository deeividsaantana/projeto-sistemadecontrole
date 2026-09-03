export type ManagedUserRole = 'admin' | 'gestor' | 'operador' | 'leitura';
export interface ManagedUser {
  id: string; firebaseUid: string; email: string | null; fullName: string;
  role: ManagedUserRole; active: boolean; lastSeenAt?: unknown;
}
export const loadManagedUsers = async (): Promise<ManagedUser[]> => ([
  { id: '1', firebaseUid: 'u1', email: 'ricardo@renea.com.br', fullName: 'Ricardo Renea', role: 'admin', active: true },
  { id: '2', firebaseUid: 'u2', email: 'aline.lima@renea.com.br', fullName: 'Aline Lima', role: 'gestor', active: true },
  { id: '3', firebaseUid: 'u3', email: 'jose.costa@renea.com.br', fullName: 'José da Silva Costa', role: 'operador', active: true },
  { id: '4', firebaseUid: 'u4', email: 'marcos.souza@renea.com.br', fullName: 'Marcos de Souza', role: 'leitura', active: false },
]);
export const createManagedUser = async (_i: unknown) => ({ uid: 'novo' });
export const updateManagedUser = async (_i: unknown) => ({ uid: 'x' });

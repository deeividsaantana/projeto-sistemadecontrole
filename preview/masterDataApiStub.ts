// Reexporta o modulo real e sobrescreve apenas as funcoes de usuarios, que
// exigem backend autenticado. O resto das telas continua usando o codigo de
// verdade, sem divergir do que roda em producao.
export * from '../src/services/masterDataApi';
import type { ManagedUser, ManagedUserRole } from '../src/services/masterDataApi';

export const loadManagedUsers = async (): Promise<ManagedUser[]> => ([
  { id: '1', firebaseUid: 'u1', email: 'ricardo@renea.com.br', fullName: 'Ricardo Renea', role: 'admin', active: true },
  { id: '2', firebaseUid: 'u2', email: 'aline.lima@renea.com.br', fullName: 'Aline Lima', role: 'gestor', active: true },
  { id: '3', firebaseUid: 'u3', email: 'jose.costa@renea.com.br', fullName: 'José da Silva Costa', role: 'operador', active: true },
  { id: '4', firebaseUid: 'u4', email: 'marcos.souza@renea.com.br', fullName: 'Marcos de Souza', role: 'leitura', active: false },
]);
export const createManagedUser = async (_input: unknown) => ({ uid: 'novo', email: '', fullName: '', role: 'operador' as ManagedUserRole });
export const updateManagedUser = async (_input: unknown) => ({ uid: 'x', role: 'operador' as ManagedUserRole, active: true });

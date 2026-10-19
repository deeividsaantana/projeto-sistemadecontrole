// Reexporta o modulo real e sobrescreve apenas as funcoes de usuarios, que
// exigem backend autenticado. O resto das telas continua usando o codigo de
// verdade, sem divergir do que roda em producao.
export * from '../src/services/masterDataApi';
import type { ManagedUser, ManagedUserRole } from '../src/services/masterDataApi';

export const loadManagedUsers = async (): Promise<ManagedUser[]> => ([
  { id: '1', userId: 'u1', email: 'ricardo@renea.com.br', fullName: 'Ricardo Renea', role: 'admin', active: true },
  { id: '2', userId: 'u2', email: 'aline.lima@renea.com.br', fullName: 'Aline Lima', role: 'gestor', active: true },
  { id: '3', userId: 'u3', email: 'jose.costa@renea.com.br', fullName: 'José da Silva Costa', role: 'operador', active: true },
  { id: '4', userId: 'u4', email: 'marcos.souza@renea.com.br', fullName: 'Marcos de Souza', role: 'leitura', active: false },
]);
export const createManagedUser = async (_input: unknown) => ({ uid: 'novo', email: '', fullName: '', role: 'operador' as ManagedUserRole });
// Igual ao servidor (M12): a única conta de admin ativa não perde o perfil.
export const updateManagedUser = async (input: { uid: string; role: ManagedUserRole; active: boolean }) => {
  if (input.uid === 'u1' && (input.role !== 'admin' || !input.active)) {
    throw new Error('Esta é a única conta de administrador ativa. Dê o perfil de administrador a outra pessoa antes de mudar esta.');
  }
  return { uid: input.uid, role: input.role, active: input.active };
};

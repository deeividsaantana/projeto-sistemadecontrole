import type { ManagedUserRole } from '../../services/masterDataApi';

/** Perfis de acesso, com o que cada um pode fazer em palavras de obra. */
export const PERFIS_DE_ACESSO: Array<{ value: ManagedUserRole; label: string; faz: string }> = [
  { value: 'admin', label: 'Administrador', faz: 'Pode tudo, inclusive excluir e cuidar dos usuários.' },
  { value: 'gestor', label: 'Gestor', faz: 'Lança, aprova e zera o dia de presença, mas não exclui.' },
  { value: 'operador', label: 'Operador', faz: 'Lança em campo, mas não aprova nem exclui.' },
  { value: 'leitura', label: 'Visualização', faz: 'Só consulta, não lança nada.' },
];

import type { Funcionario } from '../types';

const VALIDADE_TOKEN_MS = 24 * 60 * 60 * 1000;

/** Acha o funcionário pela matrícula (ou id), sem diferenciar maiúsculas. */
export const validarMatricula = (matricula: string, funcionarios: readonly Funcionario[]): Funcionario | null => {
  const digitada = matricula.trim().toLowerCase();
  if (!digitada) return null;
  return funcionarios.find(f =>
    f.matricula?.trim().toLowerCase() === digitada ||
    f.id.toLowerCase() === digitada,
  ) ?? null;
};

export const gerarTokenPresencaPublica = (funcionarioId: string): string => {
  const aleatorio = Math.random().toString(36).substring(2, 15);
  return `${funcionarioId}:${Date.now()}:${aleatorio}`;
};

/** Token vale 24 h para o mesmo funcionário; data no futuro não vale. */
export const validarTokenPresencaPublica = (token: string, funcionarioId: string): boolean => {
  const [id, momento] = token.split(':');
  if (id !== funcionarioId) return false;
  const idade = Date.now() - Number.parseInt(momento, 10);
  return idade >= 0 && idade < VALIDADE_TOKEN_MS;
};

import type { Funcionario } from '../types';

/** Acha o funcionário pela matrícula (ou id), sem diferenciar maiúsculas. */
export const validarMatricula = (matricula: string, funcionarios: readonly Funcionario[]): Funcionario | null => {
  const digitada = matricula.trim().toLowerCase();
  if (!digitada) return null;
  return funcionarios.find(f =>
    f.matricula?.trim().toLowerCase() === digitada ||
    f.id.toLowerCase() === digitada,
  ) ?? null;
};

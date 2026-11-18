/** Regras da senha do primeiro acesso, as mesmas que o servidor confere (api/primeiro-acesso.js). */
export interface RegraDaSenha {
  texto: string;
  falta: string;
  ok: boolean;
}

export const regrasDaSenha = (senha: string, repetida: string): RegraDaSenha[] => [
  { texto: 'Pelo menos 8 letras ou números', falta: 'A senha precisa ter pelo menos 8 letras ou números.', ok: senha.length >= 8 && new TextEncoder().encode(senha).length <= 72 },
  { texto: 'Tem letra e número', falta: 'Use letras e números na senha.', ok: /[A-Za-zÀ-ÿ]/.test(senha) && /[0-9]/.test(senha) },
  { texto: 'As duas senhas iguais', falta: 'As duas senhas não estão iguais. Digite de novo.', ok: senha.length > 0 && senha === repetida },
];

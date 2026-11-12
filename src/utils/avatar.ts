/**
 * Regras do avatar (a bolinha de cada pessoa), iguais em todo o sistema:
 * foto quando a pessoa tem; sem foto, as iniciais sobre a cor escolhida.
 */

/** Cores que a pessoa pode escolher. Todas com contraste para letra branca. */
export const CORES_AVATAR = [
  { valor: '#176b4d', nome: 'Verde' },
  { valor: '#1d4ed8', nome: 'Azul' },
  { valor: '#6d28d9', nome: 'Roxo' },
  { valor: '#be123c', nome: 'Vinho' },
  { valor: '#c2410c', nome: 'Laranja' },
  { valor: '#334155', nome: 'Grafite' },
] as const;

export const COR_AVATAR_PADRAO = CORES_AVATAR[0].valor;

/** Primeira letra do primeiro e do último nome ("Deivid Santana" vira "DS"). */
export const iniciaisDoNome = (nome: string): string => {
  const partes = String(nome || '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

/** Quem nunca escolheu cor ganha sempre a mesma, tirada do nome. */
export const corPeloNome = (nome: string): string => {
  let soma = 0;
  for (const letra of String(nome || '').trim().toLowerCase()) soma = (soma * 31 + letra.charCodeAt(0)) % 9973;
  return CORES_AVATAR[soma % CORES_AVATAR.length].valor;
};

const semAcento = (texto: string) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Acha a pessoa pelo nome escrito num lançamento (sem ligar para acento e caixa). */
export const pessoaPeloNome = <T extends { nome: string }>(pessoas: readonly T[], nome: string): T | undefined => {
  const alvo = semAcento(nome);
  if (!alvo) return undefined;
  return pessoas.find(pessoa => semAcento(pessoa.nome) === alvo);
};

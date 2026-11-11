/**
 * Nome de quem entrou, para mostrar no topo. Usa o nome do cadastro; sem ele,
 * monta um nome a partir do e-mail (deivid.santana019@... vira "Deivid
 * Santana"), para a tela nunca mostrar o e-mail cru no lugar do nome.
 */
export function nomeDaPessoa(usuario: { displayName?: string | null; email?: string | null } | null | undefined): string {
  const nome = usuario?.displayName?.trim();
  if (nome) return nome;
  const local = usuario?.email?.split('@')[0] ?? '';
  const partes = local.replace(/\d+/g, ' ').split(/[._\-+\s]+/).filter(Boolean);
  if (partes.length === 0) return 'Usuário';
  return partes.map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase()).join(' ');
}

/** Iniciais do nome: primeira letra do primeiro e do último nome. */
export function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primeira + ultima).toUpperCase();
}

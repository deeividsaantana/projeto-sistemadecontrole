/**
 * Bolinha com as iniciais de quem fez o lançamento. A cor sai do nome, então
 * a mesma pessoa tem sempre a mesma cor em toda a linha do tempo.
 */
const CORES = [
  'bg-emerald-50 text-[#176b4d] ring-emerald-200',
  'bg-sky-50 text-sky-900 ring-sky-200',
  'bg-amber-50 text-amber-900 ring-amber-200',
  'bg-orange-50 text-[#c2410c] ring-orange-200',
  'bg-indigo-50 text-indigo-900 ring-indigo-200',
  'bg-rose-50 text-rose-800 ring-rose-200',
  'bg-slate-100 text-slate-800 ring-slate-200',
];

export const iniciais = (nome: string) => {
  const partes = nome.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes.length === 1 ? partes[0].slice(0, 2) : `${partes[0][0]}${partes[partes.length - 1][0]}`).toUpperCase();
};

const corDe = (nome: string) => {
  let soma = 0;
  for (const letra of nome.trim().toLowerCase()) soma = (soma * 31 + letra.charCodeAt(0)) % 9973;
  return CORES[soma % CORES.length];
};

export function AvatarPessoa({ nome, tamanho = 'md' }: { nome: string; tamanho?: 'sm' | 'md' }) {
  return (
    <span aria-hidden="true" title={nome}
      className={`grid shrink-0 place-items-center rounded-full font-black ring-1 ring-inset ${tamanho === 'sm' ? 'size-6 text-xs' : 'size-8 text-xs'} ${corDe(nome)}`}>
      {iniciais(nome)}
    </span>
  );
}

/** "12/11/2026 às 14:05" */
export const dataHora = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

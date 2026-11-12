import { usePessoas } from '../../app/perfil/PessoasContext';
import { Avatar } from '../../shared/ui';
import { pessoaPeloNome } from '../../utils/avatar';

/**
 * Nome de quem fez algo, com a bolinha da pessoa ao lado. Acha a foto e a cor
 * pelo nome gravado no lançamento; quem não tem conta fica com as iniciais.
 */
export function NomeComAvatar({ nome, vazio = '—' }: { nome?: string | null; vazio?: string }) {
  const pessoas = usePessoas();
  const texto = String(nome || '').trim();
  if (!texto) return <>{vazio}</>;
  const pessoa = pessoaPeloNome(pessoas, texto);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar nome={texto} foto={pessoa?.foto} cor={pessoa?.cor} tamanho="sm" />
      <span className="truncate">{texto}</span>
    </span>
  );
}

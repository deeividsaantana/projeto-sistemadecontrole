import { usePessoas } from '../../app/perfil/PessoasContext';
import { Avatar } from '../../shared/ui/Avatar';
import { pessoaPeloNome } from '../../utils/avatar';

/**
 * Bolinha de quem fez o lançamento: a foto e a cor que a pessoa escolheu em
 * "Meu perfil"; quem não tem conta fica com as iniciais numa cor fixa do nome.
 */
export function AvatarPessoa({ nome, tamanho = 'md' }: { nome: string; tamanho?: 'sm' | 'md' }) {
  const pessoa = pessoaPeloNome(usePessoas(), nome);
  return <Avatar nome={nome} foto={pessoa?.foto} cor={pessoa?.cor} tamanho={tamanho} />;
}

/** "12/11/2026 às 14:05" */
export const dataHora = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

import { useCallback, useEffect, useState } from 'react';
import { atualizarSessao } from '../../auth/supabaseAuth';
import {
  loadMyProfile,
  loadPeopleWithAvatars,
  updateMyProfile,
  type PessoaComAvatar,
} from '../../services/masterDataApi';

export interface MeuAvatar {
  nome: string;
  cor: string | null;
  foto: string | null;
}

const CHAVE_MEU = 'cintravyse_meu_perfil:';
const CHAVE_PESSOAS = 'cintravyse_pessoas_avatar';

const ler = <T,>(chave: string): T | null => {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) as T : null;
  } catch { return null; }
};
const guardar = (chave: string, valor: unknown) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem espaço: só não fica guardado */ }
};

/**
 * Perfil de quem entrou e avatares da equipe. Mostra na hora o que ficou
 * guardado neste aparelho e atualiza com a nuvem em segundo plano, então o
 * topo nunca pisca sem nome nem espera a internet.
 */
export function usePerfis(userId: string | null) {
  const [meuAvatar, setMeuAvatar] = useState<MeuAvatar | null>(() => (userId ? ler<MeuAvatar>(CHAVE_MEU + userId) : null));
  const [pessoas, setPessoas] = useState<PessoaComAvatar[]>(() => ler<PessoaComAvatar[]>(CHAVE_PESSOAS) || []);

  useEffect(() => {
    if (!userId) { setMeuAvatar(null); return; }
    setMeuAvatar(ler<MeuAvatar>(CHAVE_MEU + userId));
    let ativo = true;
    loadMyProfile()
      .then(perfil => {
        if (!ativo) return;
        const proximo = { nome: perfil.fullName, cor: perfil.avatarColor, foto: perfil.avatarPhoto };
        setMeuAvatar(proximo);
        guardar(CHAVE_MEU + userId, proximo);
      })
      .catch(() => { /* sem nuvem: fica o que está guardado */ });
    loadPeopleWithAvatars()
      .then(lista => {
        if (!ativo) return;
        setPessoas(lista);
        guardar(CHAVE_PESSOAS, lista);
      })
      .catch(() => { /* sem nuvem: fica o que está guardado */ });
    return () => { ativo = false; };
  }, [userId]);

  const salvarMeuPerfil = useCallback(async ({ nome, cor, foto }: { nome: string; cor: string; foto: string | null }) => {
    if (!userId) throw new Error('Entre de novo para salvar o perfil.');
    const salvo = await updateMyProfile({ fullName: nome, avatarColor: cor, avatarPhoto: foto ?? '' });
    const proximo = { nome: salvo.fullName, cor: salvo.avatarColor, foto: salvo.avatarPhoto };
    setMeuAvatar(proximo);
    guardar(CHAVE_MEU + userId, proximo);
    setPessoas(lista => {
      const outra = lista.filter(pessoa => pessoa.userId !== userId);
      const nova = [...outra, { userId, nome: proximo.nome, cor: proximo.cor || '', foto: proximo.foto }]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      guardar(CHAVE_PESSOAS, nova);
      return nova;
    });
    await atualizarSessao().catch(() => undefined);
  }, [userId]);

  return { meuAvatar, pessoas, salvarMeuPerfil };
}

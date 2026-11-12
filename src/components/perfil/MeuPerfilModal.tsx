import { useEffect, useRef, useState } from 'react';
import { Button, Modal, TextInput } from '../../shared/ui';
import { COR_AVATAR_PADRAO } from '../../utils/avatar';
import { EscolherAvatar } from './EscolherAvatar';
import { PERFIS_DE_ACESSO } from './perfisDeAcesso';

export interface DadosMeuPerfil {
  nome: string;
  email: string | null;
  papel: string;
  cor: string | null;
  foto: string | null;
}

interface MeuPerfilModalProps {
  open: boolean;
  perfil: DadosMeuPerfil;
  onClose: () => void;
  /** Recebe só o que a pessoa pode mudar; devolve erro em texto ou nada. */
  onSalvar: (mudancas: { nome: string; cor: string; foto: string | null }) => Promise<void>;
}

/**
 * "Meu perfil": a própria pessoa troca nome, foto e cor. O perfil de acesso só
 * aparece para leitura, com o que ele permite, porque quem muda é o administrador.
 */
export function MeuPerfilModal({ open, perfil, onClose, onSalvar }: MeuPerfilModalProps) {
  const [nome, setNome] = useState(perfil.nome);
  const [cor, setCor] = useState(perfil.cor || COR_AVATAR_PADRAO);
  const [foto, setFoto] = useState<string | null>(perfil.foto);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setNome(perfil.nome);
    setCor(perfil.cor || COR_AVATAR_PADRAO);
    setFoto(perfil.foto);
    setErro('');
  }, [open, perfil.nome, perfil.cor, perfil.foto]);

  const papel = PERFIS_DE_ACESSO.find(item => item.value === perfil.papel);
  const nomeLimpo = nome.trim();

  const salvar = async () => {
    if (!nomeLimpo) { setErro('Escreva o seu nome.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({ nome: nomeLimpo, cor, foto });
      onClose();
    } catch (caught) {
      setErro(caught instanceof Error ? caught.message : 'Não foi possível salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Meu perfil"
      description="Seu nome e sua foto aparecem no topo e em tudo o que você lança."
      size="sm"
      busy={salvando}
      onClose={onClose}
      onSubmit={() => void salvar()}
      initialFocusRef={nomeRef}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <EscolherAvatar nome={nomeLimpo || perfil.nome} foto={foto} cor={cor} disabled={salvando} onFoto={setFoto} onCor={setCor} />
        <label className="block space-y-1.5">
          <span className="block text-xs font-bold text-slate-500">Seu nome</span>
          <TextInput ref={nomeRef} value={nome} onChange={event => setNome(event.target.value)} autoComplete="name" maxLength={120} aria-invalid={!nomeLimpo || undefined} />
        </label>
        <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          {perfil.email && (
            <div>
              <dt className="text-xs font-bold text-slate-500">E-mail de entrada</dt>
              <dd className="break-words font-medium text-slate-900">{perfil.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-bold text-slate-500">Perfil de acesso</dt>
            <dd className="font-medium text-slate-900">{papel?.label || perfil.papel}</dd>
            {papel && <dd className="text-xs text-slate-600">{papel.faz} Para mudar, fale com o administrador.</dd>}
          </div>
        </dl>
        {erro && <p role="alert" className="text-sm font-semibold text-rose-700">{erro}</p>}
      </div>
    </Modal>
  );
}

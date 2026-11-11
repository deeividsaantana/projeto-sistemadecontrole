import { useMemo, useState } from 'react';
import { ClipboardCopy, Link2, MessageCircle, Plus, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../../shared/ui';
import { generateSecurePublicToken } from '../../utils/publicLinkSecurity';
import type { GrupoEquipe } from '../../types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO } from './estilos';

interface LinkPresencaProps {
  gruposEquipe: GrupoEquipe[];
  onSaveGrupoEquipe?: (grupo: GrupoEquipe, isNew: boolean) => void;
}

/**
 * Link geral de presença: o endereço que os responsáveis de campo usam para
 * lançar a presença da equipe. Morava na Administração; foi para Cadastros
 * quando a Administração saiu do menu (10/11/2026).
 */
export default function LinkPresenca({ gruposEquipe, onSaveGrupoEquipe }: LinkPresencaProps) {
  const [aviso, setAviso] = useState('');
  const [renovando, setRenovando] = useState(false);
  const ativos = useMemo(
    () => gruposEquipe.filter(grupo => grupo.status === 'ativo' && grupo.linkAtivo !== false),
    [gruposEquipe],
  );
  const dono = ativos.find(grupo => grupo.tokenGeral) || ativos[0];
  const token = ativos.find(grupo => grupo.tokenGeral)?.tokenGeral || '';
  const link = token ? `${window.location.origin}/presenca-link/${encodeURIComponent(token)}` : '';

  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setAviso('Link copiado.');
    } catch {
      setAviso(link);
    }
  };

  const gerar = () => {
    if (!dono || !onSaveGrupoEquipe) {
      setAviso('Crie uma equipe ativa antes de gerar o link geral.');
      return;
    }
    if (token && !renovando) {
      setRenovando(true);
      return;
    }
    setRenovando(false);
    onSaveGrupoEquipe({ ...dono, tokenGeral: `geral-${generateSecurePublicToken('presenca')}`, updatedAt: new Date().toISOString() }, false);
    setAviso(token ? 'Link geral renovado.' : 'Link geral criado.');
  };

  return (
    <section className={`${CARTAO} p-4 sm:p-5`} aria-labelledby="link-presenca-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-[#176b4d]"><Link2 className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 id="link-presenca-titulo" className="text-base font-black text-slate-900">Link de presença</h2>
            <p className="text-sm text-slate-600">Os responsáveis de campo lançam a presença da equipe por este endereço.</p>
          </div>
        </div>
        {token && (
          <button type="button" onClick={gerar} className={BOTAO_SECUNDARIO}>
            <RotateCcw className="size-4" aria-hidden="true" />Renovar link
          </button>
        )}
      </div>
      {link ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="min-w-0">
            <span className="sr-only">Endereço do link de presença</span>
            <input readOnly value={link} className={`${CAMPO} min-w-0 font-mono`} />
          </label>
          <button type="button" onClick={() => void copiar()} className={BOTAO_SECUNDARIO}>
            <ClipboardCopy className="size-4" aria-hidden="true" />Copiar
          </button>
          <button
            type="button"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Registre a presença da sua equipe: ${link}`)}`, '_blank', 'noopener,noreferrer')}
            className={BOTAO_PRIMARIO}
          >
            <MessageCircle className="size-4" aria-hidden="true" />WhatsApp
          </button>
        </div>
      ) : (
        <button type="button" onClick={gerar} className={`${BOTAO_PRIMARIO} mt-4`}>
          <Plus className="size-4" aria-hidden="true" />Criar link geral
        </button>
      )}
      {aviso && <p role="status" className="mt-2 text-sm font-semibold text-[#176b4d]">{aviso}</p>}
      <ConfirmDialog
        open={renovando}
        tone="warning"
        title="Renovar o link de presença?"
        description="O endereço atual deixa de funcionar. Quem usa o link antigo vai precisar do novo."
        confirmLabel="Renovar link"
        onConfirm={gerar}
        onCancel={() => setRenovando(false)}
      />
    </section>
  );
}

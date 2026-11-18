import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from '../cadastros/estilos';

/** Endereço que a pessoa abre para criar a própria senha. */
export const enderecoDoPrimeiroAcesso = (token: string, origem = window.location.origin) => `${origem}/primeiro-acesso/${token}`;

export const VALIDADE_DO_LINK = '7 dias';

/**
 * Caixa com o link de primeiro acesso: copiar ou mandar no WhatsApp. Quem
 * criou o login só passa o link; a senha a pessoa cria sozinha.
 */
export function LinkDePrimeiroAcesso({ nome, email, token }: { nome: string; email: string; token: string }) {
  const [copiado, setCopiado] = useState(false);
  const link = enderecoDoPrimeiroAcesso(token);
  const primeiroNome = nome.trim().split(' ')[0] || nome;
  const mensagem = `Olá, ${primeiroNome}! Seu acesso ao sistema foi criado. Abra este link, crie a sua senha e entre: ${link}`;
  return (
    <div className="grid gap-3" data-testid="link-primeiro-acesso">
      <p className="text-sm text-slate-700">
        Mande este link para <strong>{nome}</strong>. Ela abre, cria a própria senha e já entra com <strong className="[overflow-wrap:anywhere]">{email}</strong>.
      </p>
      <p className="break-all rounded-xl border border-slate-200 bg-[#f7f8f6] p-3 font-mono text-sm text-slate-900 select-all">{link}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => {
          void navigator.clipboard?.writeText(link).then(() => setCopiado(true), () => setCopiado(false));
        }}>
          <Copy className="size-4" aria-hidden="true" /> {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" className={BOTAO_PRIMARIO}>
          <MessageCircle className="size-4" aria-hidden="true" /> Mandar no WhatsApp
        </a>
      </div>
      <p className="text-xs text-slate-600">Vale {VALIDADE_DO_LINK} e funciona uma vez só. Você não vê a senha da pessoa. Se vencer, gere outro em "Link para criar senha".</p>
    </div>
  );
}

import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from '../cadastros/estilos';

/** Texto que quem criou o login manda para a pessoa: endereço do sistema e o e-mail dela. */
export const textoDoAviso = (nome: string, email: string, site: string) => {
  const primeiroNome = nome.trim().split(' ')[0] || nome;
  return `Olá, ${primeiroNome}! Seu acesso ao sistema foi criado. Abra ${site}, digite o e-mail ${email} e crie a sua senha.`;
};

/**
 * Login criado: a pessoa cria a própria senha na tela de entrada, digitando
 * o e-mail. Aqui só sai o aviso para mandar a ela (copiar ou WhatsApp).
 */
export function AvisoDePrimeiroAcesso({ nome, email }: { nome: string; email: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensagem = textoDoAviso(nome, email, window.location.origin);
  return (
    <div className="grid gap-3" data-testid="aviso-primeiro-acesso">
      <p className="text-sm text-slate-700">
        Avise <strong>{nome}</strong>: ao abrir o sistema e digitar <strong className="[overflow-wrap:anywhere]">{email}</strong>, aparece <strong>Crie sua senha</strong>. Ela mesma cria, e você não fica sabendo.
      </p>
      <p className="rounded-xl border border-slate-200 bg-[#f7f8f6] p-3 text-sm text-slate-900 [overflow-wrap:anywhere]">{mensagem}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => {
          void navigator.clipboard?.writeText(mensagem).then(() => setCopiado(true), () => setCopiado(false));
        }}>
          <Copy className="size-4" aria-hidden="true" /> {copiado ? 'Aviso copiado' : 'Copiar aviso'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" className={BOTAO_PRIMARIO}>
          <MessageCircle className="size-4" aria-hidden="true" /> Mandar no WhatsApp
        </a>
      </div>
    </div>
  );
}

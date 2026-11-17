import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { BOTAO_SECUNDARIO, CARTAO } from '../cadastros/estilos';
import { carregarPeloLink, type DadosDoLink } from '../../services/contratacaoApi';
import { FolhaContratacao } from './FolhaContratacao';

/** Cartão no centro da tela, no mesmo jeito da entrada do link de presença. */
function Aviso({ titulo, texto, tom = 'neutro', children }: { titulo: string; texto: string; tom?: 'neutro' | 'erro'; children?: ReactNode }) {
  const Icone = tom === 'erro' ? AlertCircle : CheckCircle2;
  return (
    <section className="flex min-h-[70dvh] items-center justify-center" aria-labelledby="ct-link-aviso">
      <div className={`${CARTAO} w-full max-w-md p-6 text-center shadow-sm sm:p-8`} data-testid="contratacao-link-aviso">
        <Icone className={`mx-auto mb-4 size-10 ${tom === 'erro' ? 'text-rose-700' : 'text-[#176b4d]'}`} aria-hidden="true" />
        <h1 id="ct-link-aviso" className="mb-2 text-2xl font-black text-slate-950">{titulo}</h1>
        <p className="text-sm text-slate-600">{texto}</p>
        {children}
      </div>
    </section>
  );
}

/**
 * Link individual de um pedido (/contratacao-link/<token>). O login já foi
 * pedido antes; aqui o servidor diz se o link vale. Encerrado, aparece só o
 * aviso de expirado, sem nenhum dado do candidato.
 */
export function ContratacaoPeloLink({ token }: { token: string }) {
  const [dados, setDados] = useState<DadosDoLink | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setDados(await carregarPeloLink(token));
      setErro('');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível abrir o link.');
    }
  }, [token]);

  useEffect(() => { void carregar(); }, [carregar]);

  if (erro) {
    return (
      <Aviso titulo="Não deu para abrir" texto={erro} tom="erro">
        <button type="button" onClick={() => { setErro(''); void carregar(); }} className={`${BOTAO_SECUNDARIO} mt-6 w-full`}>Tentar de novo</button>
      </Aviso>
    );
  }
  if (!dados) return <p className="p-6 text-sm text-[#5b6870]" role="status">Abrindo a solicitação…</p>;
  if (!('request' in dados)) {
    return dados.expirado === 'recusada'
      ? <Aviso titulo="Link encerrado" texto="Este link foi encerrado. A solicitação foi recusada." tom="erro" />
      : <Aviso titulo="Link expirado" texto="Este link expirou. A solicitação já foi concluída e assinada por todas as partes." />;
  }
  return (
    <FolhaContratacao
      key={`${dados.request.id}-${dados.request.version}`}
      pedido={dados.request}
      leitor={dados.me}
      titulares={dados.titulares}
      token={token}
      onAtualizado={() => void carregar()}
    />
  );
}

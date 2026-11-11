/**
 * Quem faz o quê no módulo. Só o administrador vê. A pessoa é reconhecida pelo
 * e-mail do login; sem e-mail, pelo nome igual ao do login.
 */
import { useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from '../cadastros/estilos';
import { NOME_DO_PAPEL, PAPEIS_SUPRIMENTOS, type PapelSuprimentos, type PessoaSuprimentos } from '../../utils/solicitacoes';

export function PessoasSuprimentosLista({ pessoas, onSalvar }: { pessoas: PessoaSuprimentos[]; onSalvar: (pessoas: PessoaSuprimentos[]) => void }) {
  const [rascunho, setRascunho] = useState(pessoas);
  const [salvo, setSalvo] = useState(false);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(pessoas);

  const mudar = (id: string, mudanca: Partial<PessoaSuprimentos>) => {
    setSalvo(false);
    setRascunho(atual => atual.map(pessoa => (pessoa.id === id ? { ...pessoa, ...mudanca } : pessoa)));
  };

  const colunas: ColunaTabela<PessoaSuprimentos>[] = [
    { chave: 'nome', titulo: 'Nome', larguraMinima: 180, render: pessoa => <input aria-label="Nome" value={pessoa.nome} onChange={event => mudar(pessoa.id, { nome: event.target.value })} className={CAMPO} />, valorOrdenacao: pessoa => pessoa.nome, valorExportacao: pessoa => pessoa.nome },
    { chave: 'email', titulo: 'E-mail do login', larguraMinima: 220, render: pessoa => <input aria-label={`E-mail de ${pessoa.nome}`} type="email" value={pessoa.email ?? ''} placeholder="opcional" onChange={event => mudar(pessoa.id, { email: event.target.value || undefined })} className={CAMPO} />, valorExportacao: pessoa => pessoa.email },
    { chave: 'papel', titulo: 'Papel', larguraMinima: 200, render: pessoa => (
      <select aria-label={`Papel de ${pessoa.nome}`} value={pessoa.papel} onChange={event => mudar(pessoa.id, { papel: event.target.value as PapelSuprimentos })} className={CAMPO}>
        {PAPEIS_SUPRIMENTOS.map(papel => <option key={papel} value={papel}>{NOME_DO_PAPEL[papel]}</option>)}
      </select>
    ), valorOrdenacao: pessoa => pessoa.papel, valorExportacao: pessoa => NOME_DO_PAPEL[pessoa.papel] },
    { chave: 'ativo', titulo: 'Ativo', render: pessoa => (
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={pessoa.ativo} onChange={event => mudar(pessoa.id, { ativo: event.target.checked })} className="size-5 accent-[#176b4d]" />
        {pessoa.ativo ? 'Sim' : 'Não'}
      </label>
    ), valorExportacao: pessoa => (pessoa.ativo ? 'Sim' : 'Não') },
  ];

  return (
    <div className="grid min-h-0 gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setSalvo(false); setRascunho(atual => [...atual, { id: `sup-${Date.now()}`, nome: 'Nova pessoa', papel: 'recebedor', ativo: true }]); }} className={BOTAO_SECUNDARIO}>
          <Plus className="size-4" aria-hidden="true" /> Adicionar pessoa
        </button>
        <button type="button" disabled={!mudou} onClick={() => { onSalvar(rascunho.map(pessoa => ({ ...pessoa, nome: pessoa.nome.trim(), email: pessoa.email?.trim() || undefined }))); setSalvo(true); }} className={BOTAO_PRIMARIO}>
          <Save className="size-4" aria-hidden="true" /> Salvar pessoas
        </button>
        {salvo && !mudou && <span role="status" className="self-center text-sm font-bold text-[#176b4d]">Salvo.</span>}
      </div>
      <TabelaPadrao titulo="Pessoas e papéis do módulo" linhas={rascunho} colunas={colunas} idDaLinha={pessoa => pessoa.id}
        nomeDoItem={{ um: 'pessoa', varios: 'pessoas' }} semPaginacao exportar={false} />
    </div>
  );
}

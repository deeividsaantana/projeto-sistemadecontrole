import { ACESSOS, CONVENIOS, DEVOLUCAO, MOTIVOS_DESLIGAMENTO, PROCEDIMENTOS } from '../../../api/_shared/contratacao-regras.js';
import { FOCO } from '../cadastros/estilos';
import { LinhaPapel, MarcasPapel, SecaoPapel, entradaPapel, type CorpoProps } from './papel';

/**
 * Desligamento no desenho do "Check list de desligamento"
 * (SGR-FRH-21-373-01-000-000-0027): dados do colaborador, motivo, convênios,
 * procedimento do RH, acessos e devolução de itens, na ordem do modelo.
 */
export function CorpoDesligamento({ form, novo, mudar, alternar, erroDe, mensagem }: CorpoProps) {
  const linha = { novo, mudar, erroDe, mensagem };
  const marcas = { novo, erroDe, mensagem };

  return (
    <div className="pb-2">
      <div className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:px-6">
        <LinhaPapel nome="candidato" rotulo="Nome:" valor={form.candidato} {...linha} />
        <LinhaPapel nome="registro" rotulo="Matrícula:" valor={form.registro} {...linha} className="sm:w-52" />
        <LinhaPapel nome="admissao" rotulo="Data de admissão:" valor={form.admissao} data {...linha} className="sm:w-72" />
        <LinhaPapel nome="posicao" rotulo="Cargo / Setor:" valor={form.posicao} {...linha} className="sm:col-span-3" />
        <LinhaPapel nome="desligamento" rotulo="Data do desligamento:" valor={form.desligamento} data {...linha} className="sm:col-span-3 sm:max-w-md" />
        <LinhaPapel nome="data" rotulo="Data da solicitação:" valor={form.data} data {...linha} className="sm:col-span-3 sm:max-w-md" />
      </div>

      <SecaoPapel titulo="Motivo / Solicitação do Desligamento" linha>
        <MarcasPapel nome="motivoDeslig" rotulo="Motivo do desligamento" unica opcoes={MOTIVOS_DESLIGAMENTO} marcados={form.motivoDeslig ? [form.motivoDeslig] : []} onMarcar={valor => mudar('motivoDeslig', valor)} colunas="sm:grid-cols-2" {...marcas} />
        <div className="mt-3 grid gap-3">
          <LinhaPapel nome="solicitadoPor" rotulo="Nome de quem solicitou o desligamento (quando aplicável):" valor={form.solicitadoPor} {...linha} />
          <LinhaPapel nome="pagamentoRescisao" rotulo="Data prevista para pagamento da rescisão:" valor={form.pagamentoRescisao} data {...linha} className="sm:max-w-xl" />
        </div>
      </SecaoPapel>

      <SecaoPapel titulo="CONVÊNIOS">
        <MarcasPapel nome="convenios" rotulo="Convênios" opcoes={CONVENIOS} marcados={form.convenios ?? []} onMarcar={valor => alternar('convenios', valor)} {...marcas} />
        <label className="mt-3 flex min-w-0 items-end gap-2">
          <span className="shrink-0 pb-2 text-sm text-slate-800">Observações:</span>
          {novo
            ? <input name="obs" value={form.obs} onChange={evento => mudar('obs', evento.target.value)} className={entradaPapel(novo)} />
            : <span className={`${entradaPapel(false)} flex items-end pb-2 whitespace-pre-line`}>{form.obs || '—'}</span>}
        </label>
      </SecaoPapel>

      <SecaoPapel titulo="PROCEDIMENTO">
        <MarcasPapel nome="procedimentos" rotulo="Procedimento" opcoes={PROCEDIMENTOS} marcados={form.procedimentos ?? []} onMarcar={valor => alternar('procedimentos', valor)} {...marcas} />
      </SecaoPapel>

      <SecaoPapel titulo="ACESSOS E SISTEMAS" linha>
        <MarcasPapel nome="acessos" rotulo="Acessos e sistemas" opcoes={ACESSOS} marcados={form.acessos ?? []} onMarcar={valor => alternar('acessos', valor)} {...marcas} />
      </SecaoPapel>

      <SecaoPapel titulo="DEVOLUÇÃO DE ITENS" linha>
        <MarcasPapel
          nome="devolucao"
          rotulo="Devolução de itens"
          opcoes={DEVOLUCAO}
          marcados={form.devolucao ?? []}
          onMarcar={valor => alternar('devolucao', valor)}
          extra={{ uniforme: (
            <input
              name="devolucaoOutros"
              aria-label="Quais outros itens"
              readOnly={!novo || !(form.devolucao ?? []).includes('uniforme')}
              value={form.devolucaoOutros ?? ''}
              onChange={evento => mudar('devolucaoOutros', evento.target.value)}
              className={`${entradaPapel(novo)} max-w-60 ${FOCO}`}
            />
          ) }}
          {...marcas}
        />
      </SecaoPapel>
    </div>
  );
}

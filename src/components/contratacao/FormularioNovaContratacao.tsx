import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { BOTAO_PRIMARIO, CAMPO, CAMPO_SELECT, CARTAO, ROTULO } from '../cadastros/estilos';
import { ITENS, MOTIVOS, PRIORIDADES, TIPOS, validarFormulario } from '../../../api/_shared/contratacao-regras.js';
import { criarContratacao, type AssinaturaEnviada, type FormularioContratacao, type PedidoContratacao } from '../../services/contratacaoApi';
import { QuadroAssinatura } from './QuadroAssinatura';

const hojeLocal = () => {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const novaChave = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');

interface Props {
  nome: string;
  onCriado: (pedido: PedidoContratacao) => void;
}

function Campo({ id, rotulo, erro, children, className }: { id: string; rotulo: string; erro?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className={ROTULO}>{rotulo}</label>
      {children}
      {erro && <p id={`${id}-erro`} className="text-xs font-semibold text-rose-700">{erro}</p>}
    </div>
  );
}

/** Formulário do documento + assinatura do solicitante, enviados juntos. */
export function FormularioNovaContratacao({ nome, onCriado }: Props) {
  const [form, setForm] = useState<FormularioContratacao>(() => ({
    data: hojeLocal(), prioridade: '', motivo: '', motivoOutro: '', tipo: '', posicao: '', quantidade: '1',
    salario: '', requisitante: nome, area: '', itens: [], obs: '', aprovados: '', comentarios: '',
  }));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [assinando, setAssinando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState('');
  const chave = useRef(novaChave());
  const topo = useRef<HTMLFormElement>(null);

  const mudar = <K extends keyof FormularioContratacao>(campo: K, valor: FormularioContratacao[K]) => {
    setForm(atual => ({ ...atual, [campo]: valor }));
    setErros(atual => { const { [campo]: _removido, ...resto } = atual; return resto; });
  };
  const alternarItem = (item: string) => {
    const marcado = form.itens.includes(item);
    const proximos = item === 'nenhum'
      ? (marcado ? [] : ['nenhum'])
      : (marcado ? form.itens.filter(atual => atual !== item) : [...form.itens.filter(atual => atual !== 'nenhum'), item]);
    mudar('itens', proximos);
  };

  const conferir = () => {
    const { erros: encontrados } = validarFormulario(form);
    setErros(encontrados);
    if (Object.keys(encontrados).length) {
      const primeiro = Object.keys(encontrados)[0];
      topo.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }
    setAssinando(true);
  };

  const enviar = async (assinatura: AssinaturaEnviada) => {
    setEnviando(true);
    setFalha('');
    try {
      const pedido = await criarContratacao(form, assinatura, chave.current);
      chave.current = novaChave();
      onCriado(pedido);
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const ariaErro = (campo: string) => (erros[campo] ? { 'aria-invalid': true as const, 'aria-describedby': `ct-${campo}-erro` } : {});
  const radio = 'size-5 shrink-0 accent-[#176b4d]';
  const opcao = 'flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50';
  const totalErros = useMemo(() => Object.keys(erros).length, [erros]);

  return (
    <form ref={topo} noValidate onSubmit={evento => { evento.preventDefault(); conferir(); }} className="mx-auto w-full max-w-4xl space-y-4" data-testid="form-contratacao">
      {totalErros > 0 && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Falta preencher {totalErros === 1 ? '1 campo' : `${totalErros} campos`}. Eles estão marcados em vermelho.
        </p>
      )}
      <fieldset disabled={assinando} className={`${CARTAO} space-y-4 p-4 sm:p-5`}>
        <legend className="sr-only">Identificação</legend>
        <h3 className="text-sm font-black text-slate-900">1. Identificação</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo id="ct-data" rotulo="Data da solicitação" erro={erros.data}>
            <input id="ct-data" name="data" type="date" value={form.data} onChange={e => mudar('data', e.target.value)} className={CAMPO} {...ariaErro('data')} />
          </Campo>
          <Campo id="ct-prioridade" rotulo="Prioridade" erro={erros.prioridade}>
            <select id="ct-prioridade" name="prioridade" value={form.prioridade} onChange={e => mudar('prioridade', e.target.value)} className={CAMPO_SELECT} {...ariaErro('prioridade')}>
              <option value="">Escolha</option>
              {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Campo>
          <Campo id="ct-quantidade" rotulo="Quantidade de vagas" erro={erros.quantidade}>
            <input id="ct-quantidade" name="quantidade" type="number" inputMode="numeric" min={1} max={999} value={form.quantidade} onChange={e => mudar('quantidade', e.target.value)} className={CAMPO} {...ariaErro('quantidade')} />
          </Campo>
          <Campo id="ct-posicao" rotulo="Posição a contratar" erro={erros.posicao}>
            <input id="ct-posicao" name="posicao" value={form.posicao} onChange={e => mudar('posicao', e.target.value)} placeholder="Ex.: Operador de escavadeira" className={CAMPO} {...ariaErro('posicao')} />
          </Campo>
          <Campo id="ct-salario" rotulo="Salário (opcional)">
            <input id="ct-salario" name="salario" value={form.salario} onChange={e => mudar('salario', e.target.value)} placeholder="Ex.: R$ 3.500,00" className={CAMPO} />
          </Campo>
          <Campo id="ct-area" rotulo="Área ou obra" erro={erros.area}>
            <input id="ct-area" name="area" value={form.area} onChange={e => mudar('area', e.target.value)} placeholder="Ex.: Complexo Viário Alto Tietê" className={CAMPO} {...ariaErro('area')} />
          </Campo>
          <Campo id="ct-requisitante" rotulo="Requisitante" erro={erros.requisitante} className="sm:col-span-3">
            <input id="ct-requisitante" name="requisitante" value={form.requisitante} onChange={e => mudar('requisitante', e.target.value)} className={CAMPO} {...ariaErro('requisitante')} />
          </Campo>
        </div>
      </fieldset>

      <fieldset disabled={assinando} className={`${CARTAO} grid gap-5 p-4 sm:grid-cols-2 sm:p-5`}>
        <legend className="sr-only">Motivo e tipo</legend>
        <div className="space-y-2" role="radiogroup" aria-labelledby="ct-motivo-titulo" {...ariaErro('motivo')}>
          <h3 id="ct-motivo-titulo" className="text-sm font-black text-slate-900">2. Motivo</h3>
          {Object.entries(MOTIVOS).map(([valor, rotulo]) => (
            <label key={valor} className={opcao}>
              <input type="radio" name="motivo" value={valor} checked={form.motivo === valor} onChange={() => mudar('motivo', valor)} className={radio} /> {rotulo}
            </label>
          ))}
          {form.motivo === 'outro' && (
            <input name="motivoOutro" aria-label="Qual é o outro motivo" value={form.motivoOutro} onChange={e => mudar('motivoOutro', e.target.value)} placeholder="Qual é o motivo?" className={CAMPO} {...ariaErro('motivoOutro')} />
          )}
          {(erros.motivo || erros.motivoOutro) && <p id="ct-motivo-erro" className="text-xs font-semibold text-rose-700">{erros.motivo || erros.motivoOutro}</p>}
        </div>
        <div className="space-y-2" role="radiogroup" aria-labelledby="ct-tipo-titulo" {...ariaErro('tipo')}>
          <h3 id="ct-tipo-titulo" className="text-sm font-black text-slate-900">3. Tipo de contratação</h3>
          {Object.entries(TIPOS).map(([valor, rotulo]) => (
            <label key={valor} className={opcao}>
              <input type="radio" name="tipo" value={valor} checked={form.tipo === valor} onChange={() => mudar('tipo', valor)} className={radio} /> {rotulo}
            </label>
          ))}
          {erros.tipo && <p id="ct-tipo-erro" className="text-xs font-semibold text-rose-700">{erros.tipo}</p>}
        </div>
      </fieldset>

      <fieldset disabled={assinando} className={`${CARTAO} space-y-3 p-4 sm:p-5`} {...ariaErro('itens')}>
        <legend className="sr-only">Itens necessários</legend>
        <h3 className="text-sm font-black text-slate-900">4. Itens necessários para a função</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(ITENS).map(([valor, rotulo]) => (
            <label key={valor} className={`${opcao} ${valor === 'nenhum' ? 'sm:col-span-3' : ''}`}>
              <input type="checkbox" name="itens" checked={form.itens.includes(valor)} onChange={() => alternarItem(valor)} className={radio} /> {rotulo}
            </label>
          ))}
        </div>
        {erros.itens && <p id="ct-itens-erro" className="text-xs font-semibold text-rose-700">{erros.itens}</p>}
      </fieldset>

      <fieldset disabled={assinando} className={`${CARTAO} grid gap-4 p-4 sm:grid-cols-3 sm:p-5`}>
        <legend className="sr-only">Observações</legend>
        <h3 className="text-sm font-black text-slate-900 sm:col-span-3">5. Observações (opcional)</h3>
        {([['obs', 'OBS'], ['aprovados', 'Aprovados'], ['comentarios', 'Comentários']] as const).map(([campo, rotulo]) => (
          <Campo key={campo} id={`ct-${campo}`} rotulo={rotulo}>
            <textarea id={`ct-${campo}`} name={campo} rows={3} value={form[campo]} onChange={e => mudar(campo, e.target.value)} className={`${CAMPO} py-2`} />
          </Campo>
        ))}
      </fieldset>

      {assinando ? (
        <section className={`${CARTAO} space-y-3 border-emerald-300 p-4 sm:p-5`} aria-labelledby="ct-assinar-titulo">
          <h3 id="ct-assinar-titulo" className="text-sm font-black text-slate-900">6. Sua assinatura (solicitante)</h3>
          {falha && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{falha}</p>}
          <QuadroAssinatura nome={nome} rotuloConfirmar="Assinar e enviar ao RH" ocupado={enviando} onConfirmar={assinatura => void enviar(assinatura)} onCancelar={() => setAssinando(false)} />
        </section>
      ) : (
        <div className="flex justify-end">
          <button type="submit" className={BOTAO_PRIMARIO} data-testid="ir-assinar">
            Conferir e assinar <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </form>
  );
}

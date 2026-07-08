import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Send, ShieldCheck, Users } from 'lucide-react';
import {
  ApontamentoQuantidadeItem,
  ApontamentoRamo,
  ApontamentoRamoRegistro,
  ClimaApontamento,
  CondicaoApontamento,
  TurnoApontamento
} from '../types';
import {
  APONTAMENTO_CLIMAS,
  APONTAMENTO_CONDICOES,
  APONTAMENTO_EQUIPAMENTOS,
  APONTAMENTO_EMPRESA_PADRAO,
  APONTAMENTO_FUNCOES,
  APONTAMENTO_TURNOS,
  createDefaultClima,
  createDefaultCondicao,
  createQuantidadeItems,
  totalQuantidade
} from '../utils/apontamentoRamosConfig';
import reneaLogo from '../assets/images/logo-renea-branco.svg';

interface ApontamentoRamoLinkExternoProps {
  token: string;
  ramos: ApontamentoRamo[];
  registros: ApontamentoRamoRegistro[];
  isLoadingCloud: boolean;
  onSubmitApontamento: (
    ramo: ApontamentoRamo,
    payload: {
      data: string;
      empresa: string;
      responsavel: string;
      funcaoApontador: string;
      funcoes: ApontamentoQuantidadeItem[];
      equipamentos: ApontamentoQuantidadeItem[];
      clima: Record<TurnoApontamento, ClimaApontamento>;
      condicao: Record<TurnoApontamento, CondicaoApontamento>;
      descricaoAtividade: string;
      observacao: string;
    }
  ) => Promise<{ success: boolean; message: string }>;
}

const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

export default function ApontamentoRamoLinkExterno({
  token,
  ramos,
  registros,
  isLoadingCloud,
  onSubmitApontamento
}: ApontamentoRamoLinkExternoProps) {
  const [data, setData] = useState(todayInput());
  const [empresa] = useState(APONTAMENTO_EMPRESA_PADRAO);
  const [responsavel, setResponsavel] = useState('');
  const [funcaoApontador, setFuncaoApontador] = useState('Apontador');
  const [selectedRamoId, setSelectedRamoId] = useState('');
  const [funcoes, setFuncoes] = useState(createQuantidadeItems(APONTAMENTO_FUNCOES));
  const [equipamentos, setEquipamentos] = useState(createQuantidadeItems(APONTAMENTO_EQUIPAMENTOS));
  const [clima, setClima] = useState(createDefaultClima());
  const [condicao, setCondicao] = useState(createDefaultCondicao());
  const [descricaoAtividade, setDescricaoAtividade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tokenRamo = useMemo(
    () => ramos.find(item => item.token === token && item.status === 'ativo' && item.linkAtivo),
    [ramos, token]
  );

  const activeRamos = useMemo(
    () => ramos.filter(item => item.status === 'ativo' && item.linkAtivo),
    [ramos]
  );

  const canteiros = useMemo(
    () => Array.from(new Set(activeRamos.map(item => item.canteiroNome))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [activeRamos]
  );

  const selectedRamo = useMemo(
    () => activeRamos.find(item => item.id === selectedRamoId) || tokenRamo,
    [activeRamos, selectedRamoId, tokenRamo]
  );

  const alreadySent = useMemo(
    () => Boolean(selectedRamo && registros.some(item => item.ramoId === selectedRamo.id && item.data === data)),
    [data, selectedRamo, registros]
  );

  useEffect(() => {
    if (!tokenRamo) return;
    setSelectedRamoId(tokenRamo.id);
  }, [tokenRamo]);

  const updateQuantidade = (
    setter: React.Dispatch<React.SetStateAction<ApontamentoQuantidadeItem[]>>,
    nome: string,
    quantidade: number
  ) => {
    setter(prev => prev.map(item => item.nome === nome ? { ...item, quantidade: Math.max(0, quantidade || 0) } : item));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRamo || alreadySent || isSubmitting) return;
    if (!responsavel.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome do apontador antes de enviar.' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    const result = await onSubmitApontamento(selectedRamo, {
      data,
      empresa: empresa.trim(),
      responsavel: responsavel.trim(),
      funcaoApontador,
      funcoes,
      equipamentos,
      clima,
      condicao,
      descricaoAtividade: descricaoAtividade.trim(),
      observacao: observacao.trim()
    });
    setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
    setIsSubmitting(false);
  };

  if (isLoadingCloud && !tokenRamo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Clock className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
          <p className="text-sm text-slate-400 mt-3">Carregando dados do Sistema Renea...</p>
        </div>
      </div>
    );
  }

  if (!tokenRamo || !selectedRamo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-xl font-black text-white mt-4">Link indisponível</h1>
          <p className="text-sm text-slate-400 mt-2">
            O link deste ramo não foi encontrado, está inativo ou foi recriado pelo administrador.
          </p>
        </div>
      </div>
    );
  }

  const totalFuncoes = totalQuantidade(funcoes);
  const totalEquipamentos = totalQuantidade(equipamentos);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8">
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-emerald-500/20 overflow-hidden flex items-center justify-center shrink-0">
              <img src={reneaLogo} alt="RENEA" className="w-full h-full object-contain p-1.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-emerald-400 text-[10px] uppercase tracking-widest font-black">
                <ShieldCheck className="w-4 h-4" />
                Link seguro de apontamento
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white mt-1">{selectedRamo.canteiroNome}</h1>
              <p className="text-sm text-slate-400 mt-1">{selectedRamo.ramoNome} - informe seu nome abaixo</p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Canteiro</span>
                <select
                  value={selectedRamo.canteiroNome}
                  onChange={e => {
                    const nextRamo = activeRamos.find(item => item.canteiroNome === e.target.value);
                    if (nextRamo) {
                      setSelectedRamoId(nextRamo.id);
                    }
                  }}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {canteiros.map(canteiro => (
                    <option key={canteiro} value={canteiro}>{canteiro}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Ramo</span>
                <select
                  value={selectedRamo.id}
                  onChange={e => {
                    setSelectedRamoId(e.target.value);
                  }}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {activeRamos.filter(item => item.canteiroNome === selectedRamo.canteiroNome).map(item => (
                    <option key={item.id} value={item.id}>{item.ramoNome}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Data</span>
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Empresa</span>
                <input
                  value={empresa}
                  readOnly
                  className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 outline-none"
                />
              </label>
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Seu nome</span>
                <input
                  value={responsavel}
                  onChange={e => setResponsavel(e.target.value)}
                  placeholder="Nome do apontador"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  required
                />
              </label>
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Sua função</span>
                <select
                  value={funcaoApontador}
                  onChange={e => setFuncaoApontador(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {APONTAMENTO_FUNCOES.map(funcao => (
                    <option key={funcao} value={funcao}>{funcao}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <QuantidadeSection title="Funções" icon={<Users className="w-4 h-4 text-emerald-400" />} items={funcoes} total={totalFuncoes} onChange={(nome, qtd) => updateQuantidade(setFuncoes, nome, qtd)} />
            <QuantidadeSection title="Equipamentos" items={equipamentos} total={totalEquipamentos} onChange={(nome, qtd) => updateQuantidade(setEquipamentos, nome, qtd)} />
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h2 className="text-sm font-black text-white mb-3">Tempo e condição</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {APONTAMENTO_TURNOS.map(turno => (
                <div key={turno} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">{turno}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {APONTAMENTO_CLIMAS.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setClima(prev => ({ ...prev, [turno]: item }))}
                        className={`min-h-9 rounded-lg border text-[10px] font-black ${clima[turno] === item ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {APONTAMENTO_CONDICOES.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCondicao(prev => ({ ...prev, [turno]: item }))}
                        className={`min-h-9 rounded-lg border text-[10px] font-black ${condicao[turno] === item ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Descrição de atividade do dia</span>
              <textarea
                value={descricaoAtividade}
                onChange={e => setDescricaoAtividade(e.target.value)}
                rows={4}
                placeholder="Descreva a atividade realizada no ramo"
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500 resize-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Observação</span>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows={2}
                placeholder="Observação opcional"
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500 resize-none"
              />
            </label>
          </section>

          {alreadySent && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-100 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Este ramo já foi apontado para a data selecionada. Procure o administrativo para ajuste controlado.</span>
            </div>
          )}

          {feedback && (
            <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100' : 'bg-rose-500/10 border-rose-500/20 text-rose-100'}`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={alreadySent || isSubmitting}
            className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Enviando...' : 'Enviar apontamento do ramo'}
          </button>
        </form>
      </div>
    </div>
  );
}

function QuantidadeSection({
  title,
  icon,
  items,
  total,
  onChange
}: {
  title: string;
  icon?: React.ReactNode;
  items: ApontamentoQuantidadeItem[];
  total: number;
  onChange: (nome: string, quantidade: number) => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-1">
          Total {total}
        </span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <label key={item.nome} className="grid grid-cols-[1fr_88px] items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <span className="text-xs font-bold text-slate-300">{item.nome}</span>
            <input
              type="number"
              min={0}
              value={item.quantidade || ''}
              onChange={e => onChange(item.nome, Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-emerald-500"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

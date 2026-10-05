import { useMemo, useState } from 'react';
import type { EtapaServico, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import {
  CONTAR_LANCAMENTOS,
  classificadorDeRamo,
  classificarPorFornecedor,
  classificarPorMaterial,
  medidasDisponiveis,
  mesesComLancamento,
  montarPizza,
  movimentosDoFiltro,
  pizzaDeCusto,
  pizzaPor,
  type FiltroGraficos,
} from '../../modules/materials/graficosMateriais';
import { mesDe, nomeDoMes } from '../../modules/materials/previstoMateriais';
import { viagensDeBotaFora } from '../../modules/materials/botaFora';
import { moeda, numero } from '../../utils/formato';
import { CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';
import GraficoPizza from './GraficoPizza';

const TIPOS: ReadonlyArray<{ tipo: TipoMovimentoMaterial; nome: string; explica: string }> = [
  { tipo: 'Entrada', nome: 'Chegou', explica: 'o que chegou na obra' },
  { tipo: 'Saída', nome: 'Saiu', explica: 'o que saiu do estoque' },
  { tipo: 'Transferência', nome: 'Transporte', explica: 'as viagens de transporte' },
];

const maiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
const moedaCurta = (valor: number) => {
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (valor >= 10_000) return `R$ ${Math.round(valor / 1000).toLocaleString('pt-BR')} mil`;
  return moeda(valor);
};
const plural = (quantos: number, um: string, varios: string) => `${quantos.toLocaleString('pt-BR')} ${quantos === 1 ? um : varios}`;

interface Props {
  hoje: string;
  movimentos: readonly MovimentoMaterial[];
  etapas: readonly EtapaServico[];
  onVerMovimentos: (busca: string) => void;
  onVerBotaFora: () => void;
  onIrParaLocais: () => void;
}

/**
 * Gráficos de pizza de Materiais: de cada mês (ou de tudo), quanto cada
 * material, fornecedor e ramo representa, e para onde foi o bota-fora.
 * Três escolhas no alto valem para todas as pizzas de cima.
 */
export default function GraficosMateriais({ hoje, movimentos, etapas, onVerMovimentos, onVerBotaFora, onIrParaLocais }: Props) {
  const meses = useMemo(() => mesesComLancamento(movimentos), [movimentos]);
  const mesPadrao = meses.includes(mesDe(hoje)) ? mesDe(hoje) : meses[0] ?? '';
  const [escolhido, setEscolhido] = useState<{ tipo: TipoMovimentoMaterial; mes: string | null; medida: string | null }>({ tipo: 'Entrada', mes: null, medida: null });
  const mes = escolhido.mes ?? mesPadrao;

  const doTipo = useMemo(() => movimentosDoFiltro(movimentos, { tipo: escolhido.tipo, mes }), [escolhido.tipo, mes, movimentos]);
  const medidas = useMemo(() => medidasDisponiveis(doTipo), [doTipo]);
  // A medida escolhida some quando o mês não tem nada nela: volta para a mais usada.
  const medida = medidas.some(item => item.medida === escolhido.medida) ? escolhido.medida as string : medidas[0]?.medida ?? CONTAR_LANCAMENTOS;
  const opcaoMedida = medidas.find(item => item.medida === medida);
  const contando = medida === CONTAR_LANCAMENTOS;
  const formatar = (valor: number) => (contando ? plural(valor, 'lançamento', 'lançamentos') : `${numero(valor, 1)} ${opcaoMedida?.sigla ?? ''}`.trim());

  const classificarRamo = useMemo(() => classificadorDeRamo(etapas), [etapas]);
  const pizzas = useMemo(() => {
    const filtro: FiltroGraficos = { tipo: escolhido.tipo, mes, medida };
    return {
      material: pizzaPor(movimentos, filtro, classificarPorMaterial),
      fornecedor: pizzaPor(movimentos, filtro, classificarPorFornecedor),
      ramo: pizzaPor(movimentos, filtro, classificarRamo),
    };
  }, [classificarRamo, escolhido.tipo, medida, mes, movimentos]);
  const custo = useMemo(() => pizzaDeCusto(movimentos, { tipo: escolhido.tipo, mes }), [movimentos, escolhido.tipo, mes]);

  const botaFora = useMemo(() => {
    const viagens = viagensDeBotaFora(movimentos, etapas).filter(viagem => !mes || mesDe(viagem.movimento.data) === mes);
    const destinos = new Map<string, { chave: string; nome: string; valor: number; lancamentos: number }>();
    const residuos = new Map<string, { chave: string; nome: string; valor: number; lancamentos: number }>();
    for (const viagem of viagens) {
      const destino = destinos.get(viagem.destino.id) ?? { chave: viagem.destino.id, nome: viagem.destino.nome, valor: 0, lancamentos: 0 };
      destino.valor += viagem.viagens;
      destino.lancamentos += 1;
      destinos.set(destino.chave, destino);
      const residuo = residuos.get(viagem.residuo) ?? { chave: viagem.residuo, nome: viagem.residuo, valor: 0, lancamentos: 0 };
      residuo.valor += viagem.viagens;
      residuo.lancamentos += 1;
      residuos.set(residuo.chave, residuo);
    }
    return { destinos: montarPizza(destinos.values()), residuos: montarPizza(residuos.values()) };
  }, [etapas, mes, movimentos]);

  const tipoAtual = TIPOS.find(item => item.tipo === escolhido.tipo) ?? TIPOS[0];
  const periodo = mes ? maiuscula(nomeDoMes(mes)) : 'Todos os meses';
  const deFora = (quantos: number, motivo: string) => (quantos > 0 ? `${plural(quantos, 'lançamento ficou', 'lançamentos ficaram')} de fora: ${motivo}.` : undefined);
  const outraUnidade = contando ? '' : ' ou em outra unidade';
  const viagens = (valor: number) => plural(Math.round(valor), 'viagem', 'viagens');

  return (
    <div className="space-y-4">
      <section data-materiais-reveal aria-label="O que os gráficos mostram" className={`${CARTAO} space-y-3 p-4`}>
        <div className="grid gap-3 md:grid-cols-[auto_1fr_1fr] md:items-end">
          <fieldset>
            <legend className={ROTULO}>Mostrar</legend>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {TIPOS.map(item => (
                <button
                  key={item.tipo}
                  type="button"
                  aria-pressed={escolhido.tipo === item.tipo}
                  onClick={() => setEscolhido(atual => ({ ...atual, tipo: item.tipo }))}
                  className={`min-h-10 rounded-lg px-3 text-sm font-bold transition duration-200 ${FOCO} ${escolhido.tipo === item.tipo ? 'bg-[#176b4d] text-white shadow-sm' : 'text-slate-700 hover:bg-white'}`}
                >
                  {item.nome}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-1">
            <span className={ROTULO}>Mês</span>
            <select value={mes} onChange={event => setEscolhido(atual => ({ ...atual, mes: event.target.value }))} className={CAMPO}>
              <option value="">Todos os meses</option>
              {meses.map(item => <option key={item} value={item}>{maiuscula(nomeDoMes(item))}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Somar em</span>
            <select value={medida} onChange={event => setEscolhido(atual => ({ ...atual, medida: event.target.value }))} className={CAMPO}>
              {medidas.map(item => (
                <option key={item.medida} value={item.medida}>
                  {item.medida === CONTAR_LANCAMENTOS ? item.nome : `${item.nome.toLocaleLowerCase('pt-BR') === item.sigla.toLocaleLowerCase('pt-BR') ? item.nome : `${item.nome} (${item.sigla})`} · ${plural(item.lancamentos, 'lançamento', 'lançamentos')}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-slate-600">
          <strong className="text-slate-900">{periodo}</strong>: {tipoAtual.explica}, {plural(doTipo.length, 'lançamento', 'lançamentos')}.
          {' '}Toque num nome para ver o número dele no meio da pizza.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GraficoPizza
          id="pizza-material"
          titulo="Por material"
          subtitulo={`Quanto cada material é do total, em ${contando || !opcaoMedida ? 'lançamentos' : opcaoMedida.nome === opcaoMedida.sigla ? opcaoMedida.sigla : opcaoMedida.nome.toLocaleLowerCase('pt-BR')}`}
          pizza={pizzas.material}
          formatar={formatar}
          notaDeFora={deFora(pizzas.material.deFora, contando ? 'sem material' : 'em outra unidade')}
          vazio="Nada lançado com essas escolhas."
          acao={{ rotulo: item => `Ver os ${plural(item.lancamentos, 'lançamento', 'lançamentos')} de ${item.nome}`, executar: item => onVerMovimentos(item.nome) }}
        />
        <GraficoPizza
          id="pizza-fornecedor"
          titulo="Por fornecedor"
          subtitulo="Quanto cada fornecedor trouxe do total"
          pizza={pizzas.fornecedor}
          formatar={formatar}
          notaDeFora={deFora(pizzas.fornecedor.deFora, `sem fornecedor${outraUnidade}`)}
          vazio="Nenhum lançamento com fornecedor nessas escolhas."
          acao={{ rotulo: item => `Ver os lançamentos de ${item.nome}`, executar: item => onVerMovimentos(item.nome) }}
        />
        <GraficoPizza
          id="pizza-ramo"
          titulo="Por ramo"
          subtitulo="Para qual ramo foi, pelo local de destino"
          pizza={pizzas.ramo}
          formatar={formatar}
          notaDeFora={deFora(pizzas.ramo.deFora, `destino fora dos ramos (estoque, canteiro, bota-fora) ou nome que a lista de locais não conhece${outraUnidade}`)}
          vazio="Nenhum destino ligado a um ramo nessas escolhas. Confira os nomes em Ramos e locais."
          acao={{ rotulo: item => `Ver os lançamentos do ${item.nome}`, executar: item => onVerMovimentos(item.nome) }}
        />
        <GraficoPizza
          id="pizza-custo"
          titulo="Custo por fornecedor"
          subtitulo="Quanto do dinheiro foi para cada fornecedor"
          pizza={custo}
          formatar={moeda}
          formatarCurto={moedaCurta}
          notaDeFora={deFora(custo.deFora, 'sem valor ou sem fornecedor')}
          vazio="Nenhum lançamento com valor nessas escolhas."
        />
      </div>

      <section data-materiais-reveal aria-labelledby="pizzas-bota-fora" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h2 id="pizzas-bota-fora" className="text-base font-bold text-slate-900">Bota-fora · {mes ? periodo : 'todos os meses'}</h2>
            <p className="text-sm text-slate-500">Sempre em viagens, seja qual for a escolha de cima.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onIrParaLocais} className={`min-h-10 rounded-xl px-3 text-sm font-bold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}>Ramos e locais</button>
            <button type="button" onClick={onVerBotaFora} className={`min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}>Ver bota-fora</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <GraficoPizza
            id="pizza-bota-fora-destino"
            titulo="Para onde foi"
            subtitulo="Viagens de cada aterro"
            pizza={botaFora.destinos}
            formatar={viagens}
            vazio="Nenhuma viagem de bota-fora nesse mês."
          />
          <GraficoPizza
            id="pizza-bota-fora-residuo"
            titulo="O que foi"
            subtitulo="Viagens por tipo de resíduo"
            pizza={botaFora.residuos}
            formatar={viagens}
            vazio="Nenhuma viagem de bota-fora nesse mês."
          />
        </div>
      </section>
    </div>
  );
}

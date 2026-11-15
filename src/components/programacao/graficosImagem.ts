/**
 * Gráficos do relatório de avanço desenhados em canvas e entregues como PNG,
 * para entrar igual no PDF e no Excel. Só roda no navegador, na hora de baixar.
 */
import type { AvancoDaFrente, PontoCurva } from '../../utils/programacao';

const VERDE = '#176b4d';
const LARANJA = '#f26a2e';
const TINTA = '#0f172a';
const SUAVE = '#475569';
const GRADE = '#e2e8f0';
const FONTE = 'Helvetica, Arial, sans-serif';
const ESCALA = 3;
const LETRA = 13;

const tela = (largura: number, altura: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = largura * ESCALA;
  canvas.height = altura * ESCALA;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largura, altura);
  ctx.textBaseline = 'middle';
  return { canvas, ctx };
};

const texto = (ctx: CanvasRenderingContext2D, valor: string, x: number, y: number, opcoes: { cor?: string; tamanho?: number; peso?: string; alinhar?: CanvasTextAlign } = {}) => {
  ctx.fillStyle = opcoes.cor ?? SUAVE;
  ctx.font = `${opcoes.peso ?? '400'} ${opcoes.tamanho ?? LETRA}px ${FONTE}`;
  ctx.textAlign = opcoes.alinhar ?? 'left';
  ctx.fillText(valor, x, y);
};

const diaMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const pct = (valor: number) => `${Math.round(valor)}%`;

/** Curva S previsto (tracejado laranja) x executado (cheio verde), com o dia de hoje marcado. */
export const imagemCurvaS = (curva: readonly PontoCurva[], hoje: string, largura = 640, altura = 300) => {
  const { canvas, ctx } = tela(largura, altura);
  const area = { x: 46, y: 56, l: largura - 46 - 112, a: altura - 56 - 32 };
  const total = curva.length;
  const x = (i: number) => area.x + (total <= 1 ? area.l / 2 : (i / (total - 1)) * area.l);
  const y = (valor: number) => area.y + area.a - (Math.min(100, Math.max(0, valor)) / 100) * area.a;

  // Legenda
  ctx.lineWidth = 3; ctx.strokeStyle = VERDE; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(area.x, 16); ctx.lineTo(area.x + 22, 16); ctx.stroke();
  texto(ctx, 'Executado', area.x + 28, 16, { cor: TINTA, peso: '700', tamanho: 14 });
  ctx.strokeStyle = LARANJA; ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(area.x + 130, 16); ctx.lineTo(area.x + 152, 16); ctx.stroke();
  texto(ctx, 'Previsto (cronograma)', area.x + 158, 16, { cor: TINTA, peso: '700', tamanho: 14 });
  ctx.setLineDash([]);

  // Grade e eixo Y
  ctx.lineWidth = 1;
  for (let valor = 0; valor <= 100; valor += 25) {
    ctx.strokeStyle = GRADE;
    ctx.beginPath(); ctx.moveTo(area.x, y(valor)); ctx.lineTo(area.x + area.l, y(valor)); ctx.stroke();
    texto(ctx, pct(valor), area.x - 8, y(valor), { alinhar: 'right' });
  }
  // Eixo X: até 8 datas
  const passo = Math.max(1, Math.ceil(total / 6));
  curva.forEach((ponto, i) => {
    if (i % passo !== 0 && i !== total - 1) return;
    if (i !== total - 1 && x(total - 1) - x(i) < 56) return;
    texto(ctx, diaMes(ponto.dia), x(i), area.y + area.a + 18, { alinhar: 'center' });
  });

  // Hoje
  const indiceHoje = curva.findIndex(ponto => ponto.dia === hoje);
  if (indiceHoje >= 0) {
    ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x(indiceHoje), area.y - 6); ctx.lineTo(x(indiceHoje), area.y + area.a); ctx.stroke();
    ctx.setLineDash([]);
    texto(ctx, 'hoje', x(indiceHoje), area.y - 14, { cor: TINTA, peso: '700', alinhar: 'center' });
  }

  const linha = (valores: ReadonlyArray<number | undefined>, cor: string, tracejado: boolean) => {
    ctx.strokeStyle = cor; ctx.lineWidth = tracejado ? 2.5 : 3; ctx.setLineDash(tracejado ? [7, 5] : []);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    let aberto = false;
    valores.forEach((valor, i) => {
      if (valor === undefined) { aberto = false; return; }
      if (aberto) ctx.lineTo(x(i), y(valor)); else ctx.moveTo(x(i), y(valor));
      aberto = true;
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  linha(curva.map(ponto => ponto.previsto), LARANJA, true);
  linha(curva.map(ponto => ponto.realizado), VERDE, false);

  // Rótulos diretos no último ponto de cada linha
  const ultimoReal = [...curva.keys()].reverse().find(i => curva[i].realizado !== undefined);
  const rotular = (i: number, valor: number, cor: string, nome: string, deslocar: number) => {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = cor; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x(i), y(valor), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    texto(ctx, `${nome} ${pct(valor)}`, Math.min(x(i) + 9, largura - 108), y(valor) + deslocar, { cor, peso: '700', tamanho: 14 });
  };
  if (total) rotular(total - 1, curva[total - 1].previsto, LARANJA, 'Previsto', 0);
  if (ultimoReal !== undefined) {
    const real = curva[ultimoReal].realizado as number;
    const previstoNoDia = curva[ultimoReal].previsto;
    rotular(ultimoReal, real, VERDE, 'Executado', real < previstoNoDia ? -14 : 14);
    if (indiceHoje >= 0 && ultimoReal === indiceHoje) {
      ctx.fillStyle = LARANJA; ctx.beginPath(); ctx.arc(x(indiceHoje), y(previstoNoDia), 4, 0, Math.PI * 2); ctx.fill();
      texto(ctx, `Previsto ${pct(previstoNoDia)}`, x(indiceHoje) + 8, y(previstoNoDia) - 12, { cor: LARANJA, peso: '700', tamanho: 14 });
    }
  }
  return canvas.toDataURL('image/png');
};

/** Barras por frente: executado (verde) e o risco do previsto até ontem (laranja). */
export const imagemAvancoPorFrente = (frentes: readonly AvancoDaFrente[], largura = 520) => {
  const linhaAltura = 40;
  const altura = 44 + Math.max(1, frentes.length) * linhaAltura + 8;
  const { canvas, ctx } = tela(largura, altura);
  const rotuloL = 110;
  const valorL = 92;
  const trilho = { x: rotuloL, l: largura - rotuloL - valorL - 8 };

  ctx.fillStyle = VERDE; ctx.fillRect(0, 10, 18, 10);
  texto(ctx, 'Executado', 24, 15, { cor: TINTA, peso: '700', tamanho: 14 });
  ctx.fillStyle = LARANJA; ctx.fillRect(124, 7, 3, 16);
  texto(ctx, 'Previsto até ontem', 133, 15, { cor: TINTA, peso: '700', tamanho: 14 });

  frentes.forEach((frente, i) => {
    const meio = 44 + i * linhaAltura + linhaAltura / 2;
    texto(ctx, frente.frente, 0, meio, { cor: TINTA, peso: '700', tamanho: 14 });
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath(); ctx.roundRect(trilho.x, meio - 8, trilho.l, 16, 4); ctx.fill();
    const feito = Math.min(100, frente.realizado);
    if (feito > 0) {
      ctx.fillStyle = VERDE;
      ctx.beginPath(); ctx.roundRect(trilho.x, meio - 8, Math.max(4, (feito / 100) * trilho.l), 16, 4); ctx.fill();
    }
    ctx.fillStyle = LARANJA;
    ctx.fillRect(trilho.x + (Math.min(100, frente.previsto) / 100) * trilho.l - 1.5, meio - 13, 3, 26);
    texto(ctx, `${pct(frente.realizado)} / ${pct(frente.previsto)}`, largura, meio, { cor: frente.realizado + 0.5 < frente.previsto ? '#be123c' : VERDE, peso: '700', tamanho: 14, alinhar: 'right' });
  });
  return { dataUrl: canvas.toDataURL('image/png'), largura, altura };
};

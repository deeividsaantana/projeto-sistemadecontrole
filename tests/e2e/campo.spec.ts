import { expect, test } from '@playwright/test';

// Auditoria de campo: o ERP é operado no canteiro, em pé, com luva e sol. Estes
// quatro limites não são estética — são o que faz o apontamento sair certo de
// primeira. Rodam contra todas as telas do harness, não só as principais.
const TELAS_AUDITADAS = [
  'usuarios',
  'cadastros',
  'estacas',
  'configuracoes',
  'jazida',
  'frotas',
  'consulta',
  'periodo',
  'combustivel',
  'modo-campo',
  'notificacoes',
  'administracao',
  'permissoes',
  'auditoria',
  'timeline',
  'relatorios',
  'cronograma',
  'orcamento',
  'custos',
  'indicadores',
  'pendencias',
  'ocorrencias',
  'documentos',
  'medicoes',
  'nao-conformidades',
  'inspecoes',
  'fvs',
  'planejamento',
  'producao',
  'diario-obra',
  'frentes',
  'materiais',
  'dds-treinamentos',
  'apontamentos',
  'equipes',
  'colaboradores',
  'checklist',
  'horas-paradas',
  'manutencao',
  'frota',
  'central-operacional',
  'painel',
  'presenca-admin',
  'presenca',
];

const auditarTela = () => {
  const visivel = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nomeAcessivel = (el: Element) => (
    el.getAttribute('aria-label')
    || el.getAttribute('title')
    || el.textContent
    || ''
  ).trim();

  const achados: string[] = [];

  document.querySelectorAll('button, [role="button"]').forEach(el => {
    if (!visivel(el) || (el as HTMLButtonElement).disabled) return;
    const r = el.getBoundingClientRect();
    if (!nomeAcessivel(el)) achados.push(`botão sem nome: ${String(el.className).slice(0, 50)}`);
    if (Math.min(r.width, r.height) < 24) achados.push(`alvo pequeno: ${Math.round(r.width)}x${Math.round(r.height)} "${nomeAcessivel(el).slice(0, 20)}"`);
  });

  document.querySelectorAll('input, select, textarea').forEach(el => {
    const campo = el as HTMLInputElement;
    if (!visivel(el) || ['checkbox', 'radio', 'hidden', 'range'].includes(campo.type)) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    // Abaixo de 16px o iOS dá zoom na página inteira ao tocar no campo.
    if (px < 16) achados.push(`campo ${px}px: ${campo.name || campo.placeholder || campo.type}`);
  });

  document.querySelectorAll('*').forEach(el => {
    if (el.children.length > 0 || !el.textContent?.trim() || !visivel(el)) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 11) achados.push(`texto ${px}px: "${el.textContent.trim().slice(0, 20)}"`);
  });

  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    achados.push(`barra horizontal: ${document.documentElement.scrollWidth}px em ${window.innerWidth}px`);
  }

  return achados;
};

for (const tela of TELAS_AUDITADAS) {
  test(`${tela}: legível e clicável de luva no celular`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto(`/?screen=${tela}`);
    await page.waitForTimeout(200);
    expect(await page.evaluate(auditarTela)).toEqual([]);
  });
}

# RENEA Design System

## Objetivo

O RENEA e um ERP operacional para obras. A interface privilegia leitura rapida,
decisao e registro em campo. O design deve parecer uma ferramenta de trabalho
confiavel, nunca uma pagina de marketing.

## Fundamentos

- Base: branco e neutros de baixa saturacao.
- Acento de produto: verde RENEA. Amarelo, vermelho e azul sao semanticos,
  usados somente para atencao, falha e informacao.
- Tipografia: Outfit para titulos; Geist para interface, tabelas e numeros.
- Numeros operacionais usam `tabular-nums`.
- Superficies usam linha de 1 px e raio de ate 8 px. Sombra apenas em menus,
  dialogs e elementos com elevacao funcional.
- A primeira dobra sempre mostra informacao e proxima acao; nunca uma capa.

## Escala de interface

| Token | Uso |
| --- | --- |
| `space-1` a `space-6` | espacamento interno e entre controles |
| `radius-sm` | 4 px: chips e controles pequenos |
| `radius-md` | 8 px: paineis, tabelas e drawers |
| `text-xs` | 12 px: metadados e ajuda |
| `text-sm` | 14 px: interface diaria |
| `text-base` | 16 px: titulo de painel e leitura primaria |

Nao usar texto visivel abaixo de 11 px em novos componentes.

## Padroes obrigatorios

- `PageHeader`: titulo, contexto, filtros e uma acao primaria.
- Tabelas: resumo compacto no mobile, tabela completa a partir de `md`.
- Formularios: label, campo, ajuda opcional, erro logo abaixo e estado de envio.
- Status: chip semantico, nunca cor sem texto.
- Vazio: explicar a causa e fornecer o proximo passo valido.
- Erro: manter dados ja exibidos, explicar a falha e permitir nova tentativa.
- Destrutivo: confirmacao explicita e consequencia descrita.

## Motion

- Animar apenas `transform` e `opacity`.
- Entrada de rota: 180-280 ms, `power3.out`, sem bloquear campos.
- Listas: cascata maxima de 80 ms entre itens visiveis.
- Graficos: desenhar uma vez quando dados entram em viewport, sem `ScrollTrigger`.
- `prefers-reduced-motion` desativa todo movimento nao essencial.

## Responsividade e acessibilidade

- Desktop: conteudo operacional em largura maxima de 1440 px.
- Mobile: uma coluna, alvos de toque de no minimo 44 px e barra de acao fixa
  quando existe envio ou salvamento.
- Nenhuma pagina pode ganhar scroll horizontal. Tabelas devem ter resumo e
  detalhe expansivel antes de recorrer a rolagem lateral.
- Uma unica `h1` por rota, seguida por headings em ordem semantica.

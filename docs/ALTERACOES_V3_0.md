# Alterações v3.0 — Inteligência Operacional

## Entregue

- tela de inteligência documental;
- leitura local de PDF textual, TXT, CSV e texto colado por OCR;
- classificação de combustível, ticket, NF, estacas e relatório comercial;
- extração assistida de data, hora, NF, ticket, placa, prefixo, material, quantidade, destino, perfil, comprimento e valor;
- confiança por campo, inconsistências e sugestões;
- revisão humana obrigatória para baixa confiança;
- funcionamento completo sem serviço externo de IA;
- trilha SQL para auditoria sem armazenar o documento bruto.

## Ajuste operacional do OneDrive

- sincronização automática restrita à planilha `FORNECIMENTO DE COMBUSTIVEL - AGOSTO2026.xlsx`;
- alterações nas planilhas de junho e julho não geram novos lotes;
- atualização do parser força um novo retrato somente de agosto;
- registros manuais e importados fora do OneDrive permanecem preservados.

## Limite intencional

Fotos e PDFs exclusivamente escaneados exigem texto OCR colado ou um provedor opcional. Nenhuma regra operacional depende desse provedor.

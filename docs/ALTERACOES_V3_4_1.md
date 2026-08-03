# Alterações v3.4.1

## Cadastros Mestres

- Corrigida a abertura da Planilha Mestre oficial quando o arquivo contém relações visuais incompatíveis com o ExcelJS.
- A importação tenta primeiro preservar o arquivo completo e, somente quando necessário, relê uma cópia em memória sem imagens, gráficos e tabelas visuais; o arquivo original do usuário não é alterado.
- Cadastros válidos continuam sendo promovidos e linhas inválidas ou duplicadas permanecem na fila de revisão.
- Adicionado teste de regressão para planilhas com vínculo de desenho ausente.

## Manutenção e consulta de frota

- Mantida a Central de Manutenção ilustrada da v3.4, com foto por equipamento, motorista/operador, movimentações, horas, disponibilidade, histórico e exportações em Excel/PDF.
- Atualizado o cache do aplicativo para garantir a entrega imediata da correção após o deploy.

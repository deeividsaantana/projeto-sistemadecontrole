# Alterações v3.2

## Escopo

Esta versão altera somente os cadastros provenientes da Planilha Mestre e o módulo de manutenção de equipamentos.

## Cadastros mestres

- O Centro de Revisão continua analisando e classificando todas as linhas antes da aplicação.
- O comando **Aplicar Planilha Mestre** promove linhas válidas e correspondidas para empresas, locais, colaboradores, materiais, ramos, equipamentos e veículos.
- Cadastros existentes são atualizados por identidade conhecida, sem duplicar registros.
- Linhas inválidas, duplicadas, fornecedores sem módulo próprio e vínculos não localizados permanecem na fila de revisão.
- Fotos, campos operacionais e dados manuais já existentes nos equipamentos são preservados.
- A fila de revisão passa a integrar armazenamento resiliente, backup JSON, importação, reset e sincronização Firebase.

## Manutenção

- Nova consulta visual da frota com foto, status, local, empresa, motorista ou operador e OS em aberto.
- Inclusão e troca de foto com compactação no navegador.
- Vínculo direto entre motorista ou operador e equipamento.
- OS ampliada com motivo, horímetros, horas máquina, horas equipamento, horas paradas e disponibilidade calculada.
- Registro de saída, chegada, origem, destino, mobilização, desmobilização e saída da manutenção.
- Indicadores consolidados de frota, OS abertas, equipamentos parados, horas paradas e disponibilidade média.
- Relatórios profissionais em Excel e PDF com frota, responsáveis e histórico completo das ordens.

## Compatibilidade

Todos os novos campos de ordem de serviço são opcionais. Ordens gravadas em versões anteriores continuam válidas e aparecem na nova tela.


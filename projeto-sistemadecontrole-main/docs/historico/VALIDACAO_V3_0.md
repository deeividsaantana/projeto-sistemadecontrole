# Validação ERP v3.0

## Checklist funcional

- [ ] importar `CONTROLE DE ESTACAS.xlsx`;
- [ ] confirmar que linhas incompletas aparecem como pendentes;
- [ ] registrar cravação e validar associação assistida;
- [ ] conferir saldo, sobra e perda;
- [ ] conferir NF com e sem divergência;
- [ ] filtrar painel por período, obra, empresa e ramo;
- [ ] exportar Excel integrado, PDF e CSV comercial;
- [ ] arquivar período e conferir checksum;
- [ ] restaurar período mantendo o snapshot;
- [ ] simular offline e validar indicador;
- [ ] reconectar e confirmar esvaziamento da fila;
- [ ] analisar texto de ticket, NF, estaca e comercial;
- [ ] confirmar que baixa confiança exige revisão.

## Validação técnica automatizada

- transpilação de todos os arquivos TypeScript e TSX;
- verificação estrita das regras puras;
- testes de saldo de estacas, indicadores, catálogo, snapshot e inteligência documental;
- verificação de imports relativos;
- inspeção das migrações sem comandos destrutivos;
- reconciliação da estrutura das planilhas de referência.

## Resultado desta entrega

- 102 arquivos TypeScript/TSX transpilados sem erro de sintaxe;
- imports relativos verificados sem caminhos ausentes;
- 7 módulos de domínio verificados em modo estrito sem erros;
- 8 verificações de negócio aprovadas para saldo, associação, NF, documentos, relatórios, snapshots e indicadores;
- 9 migrações SQL com delimitadores balanceados e sem `DROP TABLE` ou `TRUNCATE`;
- 21 módulos JavaScript/MJS analisados sem erros de sintaxe;
- manifesto PWA validado para instalação em modo `standalone`;
- planilha de estacas reconciliada em 16 lançamentos, 3 notas fiscais, 28 cravações, 281,7 m recebidos e 236,6 m cravados.

## Limite do ambiente

O pacote não inclui `node_modules`. Quando a instalação de dependências não estiver disponível, a validação completa do build Vite e a renderização em navegador devem ser executadas no ambiente de implantação.

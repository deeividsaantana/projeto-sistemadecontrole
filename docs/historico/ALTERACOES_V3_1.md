# Alterações da versão 3.1

Data: 01/08/2026

## Objetivo

Fechar riscos imediatos de segurança e qualidade antes da expansão dos módulos operacionais.

## Entregas

- links iniciais de presença e apontamento passam a usar tokens criptograficamente aleatórios;
- links previsíveis das versões anteriores são rotacionados na hidratação e no recebimento do backup;
- a rotação é publicada no Firebase após o login, preservando os demais dados;
- o fluxo público de tickets exige convite protegido em busca, reserva e gravação;
- a geração do link de tickets exige usuário autenticado da equipe;
- o segredo do link de tickets é criado fora do repositório durante a publicação;
- claims de perfil desconhecidas passam a receber somente acesso de leitura;
- tipagem oficial do React, do Vite e do ExcelJS foi corrigida;
- `npm run verify` executa tipagem, testes e build;
- o build do Netlify usa a verificação completa;
- GitHub Actions executa a mesma esteira em cada push e pull request;
- o cache do PWA e a identificação visual foram atualizados para v3.1.

## Compatibilidade operacional

- nenhum lançamento, ticket, presença ou apontamento é descartado;
- links fortes já existentes são preservados;
- todos os ramos continuam compartilhando o mesmo link geral quando esse era o comportamento vigente;
- junho e julho permanecem fora da sincronização automática de combustível;
- agosto de 2026 permanece como única competência automática;
- Firebase continua sendo a ponte operacional e o backup principal desta versão.

## Rotinas agendadas

`sync-manutencao` e `cleanup-cloud-data` permanecem declaradas como Scheduled Functions em `netlify.toml`. Em produção, a plataforma Netlify executa essas rotinas pelo agendador e não expõe invocação direta do endpoint agendado.

## Retorno

Em caso de regressão:

1. publicar novamente a versão v3.0;
2. restaurar o último backup JSON validado;
3. manter os tokens v3.1 já distribuídos, pois a versão anterior não deve voltar a divulgar tokens previsíveis;
4. não reativar junho ou julho no agente OneDrive.

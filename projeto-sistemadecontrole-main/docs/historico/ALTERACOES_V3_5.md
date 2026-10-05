# Alterações v3.5

## Link de presença por equipe

Cada equipe ativa continua com o seu próprio link (`/presenca-link/<token>`), agora com
três capacidades novas para quem aponta em campo.

### Inclusão de colaborador pela própria lista

- O link passa a oferecer o efetivo ativo que ainda não pertence a nenhuma equipe, com
  busca por nome, cargo ou matrícula.
- Ao incluir, o colaborador entra na equipe imediatamente e já pode receber situação,
  antes ou depois do envio do dia.
- O serviço público recusa quem já está em outra equipe ativa: ninguém é contado duas
  vezes no efetivo do dia. A verificação varre todas as equipes, não apenas as visíveis
  pelo token.
- Colaborador inativo ou fora do cadastro nunca aparece e nunca é aceito.
- O link continua sem poder criar, editar ou desativar cadastro. Ele apenas vincula
  alguém que já existe no efetivo à equipe daquele token.

### Comprovante ao reabrir o link

- O comprovante animado deixa de ser exclusivo do instante do envio: sempre que o link é
  aberto num dia que já foi enviado, ele volta a aparecer com o total de presentes, a
  quebra por situação e o horário.
- O botão **Voltar e alterar a lista** leva à conferência editável a qualquer momento do
  dia; da lista, **Ver comprovante do dia** traz o resumo de volta.
- Reaberto, o comprovante conta o que o serviço devolveu para aquele dia — inclusive
  quem foi incluído ou teve a situação alterada depois do envio original.

### Histórico dentro do comprovante

- A régua de dias enviados aparece também no comprovante, com acesso direto aos dias
  anteriores da equipe (limite de 30 dias, como antes).
- Dias anteriores permanecem em consulta: o serviço público só aceita alteração na data
  corrente.

## Tempo real no painel administrativo

- A fila `sistemarenea_public_submissions` ganhou o tipo `equipe`, com a inclusão feita
  em campo.
- O painel incorpora a inclusão ao cadastro do grupo, registra no histórico de alterações,
  notifica e envia o retrato atualizado para o Firebase — pela mesma assinatura em tempo
  real que já processa presenças e apontamentos.
- A recuperação de conflito reaplica a inclusão sobre o retrato vencedor, sem sobrescrever
  mudanças feitas em outro computador.

## Armazenamento e permissões

- Nova coleção `sistemarenea_presence_team_members`, escrita apenas pelo Admin SDK e
  fechada para o navegador nas regras do Firestore, mesmo autenticado.
- A inclusão vale no link imediatamente, mesmo com o painel administrativo fechado, e o
  vínculo definitivo é gravado quando o painel processa a fila.
- O catálogo exposto ao link não traz telefone, vínculo hierárquico nem datas: apenas id,
  nome, cargo, matrícula e empresa, com teto defensivo de 800 registros.

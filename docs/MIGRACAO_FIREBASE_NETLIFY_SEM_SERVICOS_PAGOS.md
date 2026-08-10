# Migração Firebase e Netlify sem serviços pagos

## Objetivo

Publicar o sistema usando Firebase Authentication, Firestore, Storage e Netlify,
sem RDO, Supabase ou chamada externa de IA paga. A leitura de documentos de
combustível permanece local e requer conferência humana antes da gravação.

## Antes de publicar

1. Gere um backup completo no painel do sistema e guarde-o fora do projeto.
2. No painel da Netlify, remova as variáveis legadas GEMINI_API_KEY,
   GOOGLE_API_KEY, GEMINI_DOCUMENT_MODEL e AI_ALLOWED_EMAILS.
3. Mantenha somente as variáveis Firebase necessárias, em especial a conta de
   serviço usada exclusivamente pelas funções Netlify e a organização padrão.
4. Confirme que nenhuma chave privada está em arquivos do repositório, no ZIP
   ou no navegador.

## Publicação segura

1. Publique as regras do Firestore, os índices e as regras do Storage junto
   com o frontend.
2. Publique as funções Netlify no mesmo deploy.
3. Crie o primeiro administrador no Firebase Authentication e aplique a claim
   de equipe antes do primeiro acesso ao painel.
4. Valide login, recuperação de senha, permissões de leitura e acesso de
   administrador.

## Critérios de aceite

- Não existe menu, rota, estado ou relatório de RDO.
- Não existe dependência ou variável de ambiente do Supabase.
- Não existe chamada de IA online ou chave de IA no deploy.
- Firestore e Storage recusam acesso público.
- Exclusão direta de registros pelo navegador é recusada.
- Restauração de backup e de período arquivado exige confirmação visível.
- Os anexos são privados, limitados a 10 MB e organizados por obra e módulo.

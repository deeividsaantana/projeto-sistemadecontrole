# Configurar análise inteligente no Netlify

Esse projeto funciona com dois níveis de leitura:

- Leitura local: PDF com texto interno ou texto/OCR colado no campo da tela.
- IA online: PDF escaneado, foto e escrita manual via Netlify Function + Gemini API.

Se aparecer a mensagem `IA online sem chave no Netlify`, siga estes passos.

## 1. Criar a chave

1. Acesse o Google AI Studio.
2. Crie uma API key do Gemini.
3. Copie a chave.

## 2. Cadastrar no Netlify

1. Abra o site no painel do Netlify.
2. Entre em `Site configuration`.
3. Abra `Environment variables`.
4. Clique em `Add a variable`.
5. Cadastre:

```text
GEMINI_API_KEY=sua_chave_aqui
```

Opcional:

```text
GEMINI_DOCUMENT_MODEL=gemini-2.5-flash
AI_ALLOWED_EMAILS=email1@empresa.com,email2@empresa.com
```

## 3. Redeploy

Depois de salvar as variáveis:

1. Vá em `Deploys`.
2. Clique em `Trigger deploy`.
3. Use `Deploy site`.

## 4. Testar

1. Abra o sistema publicado.
2. Entre no módulo `Combustível Inteligente`.
3. Vá em `Ler PDF ou foto`.
4. Envie um PDF/foto e clique em `Analisar documento`.

## Observações importantes

- Não coloque a chave dentro do código.
- Não envie a chave no zip.
- PDF escaneado e foto precisam da IA online para OCR completo.
- Enquanto a chave não estiver configurada, use PDF com texto interno ou cole a transcrição/OCR no campo `Texto extraído / OCR`.

// Traduz entre o formato de rota do Express e o formato de evento que os
// handlers do Netlify Functions esperam. Os handlers em netlify/functions/
// não mudam uma linha: continuam sendo (event) => {statusCode, headers, body},
// o mesmo contrato usado em produção até aqui. Isto existe só para poder
// hospedar as mesmas funções num serviço Node comum (Render), sem depender
// do runtime da Netlify.
export const toExpressHandler = handler => async (req, res) => {
  const queryStringParameters = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    queryStringParameters[key] = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
  }

  const event = {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers,
    queryStringParameters,
    body: typeof req.body === 'string' ? req.body : '',
    isBase64Encoded: false,
  };

  try {
    const result = await handler(event, {});
    res.status(Number(result?.statusCode) || 200);
    for (const [key, value] of Object.entries(result?.headers || {})) {
      res.setHeader(key, value);
    }
    res.send(result?.body ?? '');
  } catch (error) {
    console.error('Falha nao tratada na funcao publica:', error);
    res.status(500).json({ success: false, message: 'O serviço está temporariamente indisponível.' });
  }
};

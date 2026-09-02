// Mesma tradução usada em server/netlifyAdapter.js (hospedagem no Render):
// Express <-> evento do Netlify Functions. Os handlers em netlify/functions/
// continuam com o contrato original, (event) => {statusCode, headers, body}.
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

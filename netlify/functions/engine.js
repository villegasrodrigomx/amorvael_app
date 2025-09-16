// Archivo: netlify/functions/engine.js

exports.handler = async function(event, context) {
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

  if (!GOOGLE_SCRIPT_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: 'La URL del backend de Google no está configurada en Netlify.' })
    };
  }

  const queryString = new URLSearchParams(event.queryStringParameters).toString();
  const fullUrl = `${GOOGLE_SCRIPT_URL}?${queryString}`;

  try {
    const response = await fetch(fullUrl, { redirect: 'follow' });
    const data = await response.json(); // Intentará leer la respuesta de Google como JSON

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (error) {
    // Si la línea "response.json()" falla (porque Google envió HTML), este error se activará.
    return {
      statusCode: 502, // Bad Gateway
      body: JSON.stringify({ status: 'error', message: 'El backend de Google devolvió una respuesta no válida (probablemente un error).', details: error.message })
    };
  }
};

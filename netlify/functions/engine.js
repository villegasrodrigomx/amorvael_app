// engine.js - v2.1 con registro de depuración añadido

exports.handler = async function (event, context) {
  // 1. Registramos que la función se ha iniciado.
  console.log("Función 'engine' de Netlify invocada.");
  console.log("Método HTTP:", event.httpMethod);

  // 2. Obtenemos la URL secreta de Google desde las variables de Netlify.
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

  // 3. Paso de diagnóstico CRÍTICO: Verificamos si la URL existe.
  if (!GOOGLE_SCRIPT_URL) {
    const errorMessage = "ERROR FATAL: La variable de entorno GOOGLE_SCRIPT_URL no está configurada en Netlify.";
    console.error(errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: 'Error de configuración del servidor: la URL del backend no está definida.' }),
    };
  }
  console.log("Variable GOOGLE_SCRIPT_URL cargada exitosamente.");
  // --- FIN DEL PASO DE DIAGNÓSTICO ---

  let response;

  try {
    if (event.httpMethod === "POST") {
      console.log("Procesando petición POST...");
      response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body,
      });
    } else { // Asumimos GET para todas las demás peticiones
      console.log("Procesando petición GET...");
      const queryString = new URLSearchParams(event.queryStringParameters).toString();
      const fullUrl = `${GOOGLE_SCRIPT_URL}?${queryString}`;
      console.log("Contactando a la URL de Google:", fullUrl);
      response = await fetch(fullUrl);
    }

    if (!response.ok) {
        console.error("Respuesta de error desde Google Script. Estado:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Cuerpo de la respuesta de error de Google:", errorText);
        throw new Error(`El script de Google devolvió un error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Datos recibidos de Google Script con éxito.");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    
  } catch (error) {
    console.error("Ha ocurrido un error en la función de Netlify:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};

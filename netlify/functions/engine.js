// engine.js - Versión Final Verificada

exports.handler = async function (event, context) {
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
  let response;

  try {
    if (event.httpMethod === "POST") {
      response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body,
      });
    } else {
      const queryString = new URLSearchParams(event.queryStringParameters).toString();
      const fullUrl = `${GOOGLE_SCRIPT_URL}?${queryString}`;
      response = await fetch(fullUrl);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};
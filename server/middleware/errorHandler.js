import { HttpError } from "../errors/HttpError.js";

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  const parserError = error.type === "entity.parse.failed";
  const payloadTooLarge = error.type === "entity.too.large";
  const status = error instanceof HttpError
    ? error.status
    : parserError ? 400 : payloadTooLarge ? 413 : 500;
  const code = error instanceof HttpError
    ? error.code
    : parserError ? "INVALID_JSON" : payloadTooLarge ? "PAYLOAD_TOO_LARGE" : "INTERNAL_ERROR";
  const message = error instanceof HttpError
    ? error.message
    : parserError ? "O corpo da requisição contém JSON inválido."
      : payloadTooLarge ? "O corpo da requisição excede o limite permitido."
        : "Erro interno do servidor.";

  if (status >= 500) {
    console.error("Erro não tratado na API:", error);
  }

  return response.status(status).json({
    error: {
      code,
      message,
      ...(error instanceof HttpError && error.details ? { details: error.details } : {})
    }
  });
}

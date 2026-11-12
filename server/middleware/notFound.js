import { HttpError } from "../errors/HttpError.js";

export function notFound(_request, _response, next) {
  next(new HttpError(404, "ROUTE_NOT_FOUND", "Rota não encontrada."));
}

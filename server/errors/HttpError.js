export class HttpError extends Error {
  constructor(status, code, message, details, options = {}) {
    super(message, options);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

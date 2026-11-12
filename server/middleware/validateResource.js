import { isIP } from "node:net";
import { HttpError } from "../errors/HttpError.js";

const isNonEmptyString = (value, maximumLength = 200) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximumLength;

const validators = {
  connections: {
    user: (value) => isNonEmptyString(value, 120),
    vpnIp: (value) => typeof value === "string" && isIP(value),
    sourceIp: (value) => typeof value === "string" && isIP(value),
    serverId: (value) => Number.isInteger(value) && value > 0,
    sourceLocation: (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const allowedKeys = ["city", "country", "latitude", "longitude"];
      return Object.keys(value).every((key) => allowedKeys.includes(key))
        && isNonEmptyString(value.city, 120)
        && isNonEmptyString(value.country, 120)
        && Number.isFinite(value.latitude)
        && value.latitude >= -90
        && value.latitude <= 90
        && Number.isFinite(value.longitude)
        && value.longitude >= -180
        && value.longitude <= 180;
    },
    protocol: (value) => ["OpenVPN", "WireGuard"].includes(value),
    duration: (value) => typeof value === "string" && /^\d+:[0-5]\d:[0-5]\d$/.test(value),
    status: (value) => ["active", "alert", "offline"].includes(value),
    traffic: (value) => typeof value === "string" && /^\d+(?:[.,]\d+)?\s?(?:B|KB|MB|GB|TB)$/i.test(value)
  },
  servers: {
    name: (value) => isNonEmptyString(value),
    city: (value) => isNonEmptyString(value, 120),
    country: (value) => isNonEmptyString(value, 120),
    latitude: (value) => Number.isFinite(value) && value >= -90 && value <= 90,
    longitude: (value) => Number.isFinite(value) && value >= -180 && value <= 180,
    status: (value) => ["online", "warning", "offline"].includes(value)
  },
  users: {
    name: (value) => isNonEmptyString(value, 120),
    email: (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    role: (value) => isNonEmptyString(value, 80),
    lastConnection: (value) => typeof value === "string" && value.length <= 120
  },
  alerts: {
    severity: (value) => ["critical", "high", "medium"].includes(value),
    title: (value) => isNonEmptyString(value, 160),
    description: (value) => isNonEmptyString(value, 1000),
    time: (value) => isNonEmptyString(value, 120),
    status: (value) => ["active", "resolved"].includes(value)
  },
  network: {
    name: (value) => isNonEmptyString(value, 160),
    status: (value) => ["online", "warning", "offline"].includes(value)
  }
};

const requiredFields = {
  connections: ["user", "vpnIp", "sourceIp", "serverId", "protocol", "duration", "status", "traffic"],
  servers: ["name", "city", "country", "status"],
  users: ["name", "email", "role"],
  alerts: ["severity", "title", "description", "time", "status"],
  network: ["name", "status"]
};

export function validateResource(resource, mode = "create") {
  return (request, _response, next) => {
    const schema = validators[resource];
    const body = request.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return next(new HttpError(400, "VALIDATION_ERROR", "O corpo da requisição deve ser um objeto JSON."));
    }

    const allowedFields = Object.keys(schema);
    const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
    const errors = [];

    if (unknownFields.length) {
      errors.push({ fields: unknownFields, message: "Campo não permitido." });
    }

    const required = mode === "patch" ? [] : requiredFields[resource];
    for (const field of required) {
      if (!(field in body)) {
        errors.push({ field, message: "Campo obrigatório." });
      }
    }

    if (mode === "patch" && Object.keys(body).length === 0) {
      errors.push({ message: "Informe ao menos um campo para atualizar." });
    }

    for (const [field, value] of Object.entries(body)) {
      const validate = schema[field];
      if (validate && !validate(value)) {
        errors.push({ field, message: "Valor inválido." });
      }
    }

    if (errors.length) {
      return next(new HttpError(400, "VALIDATION_ERROR", "Dados inválidos.", errors));
    }

    request.validatedBody = body;
    return next();
  };
}

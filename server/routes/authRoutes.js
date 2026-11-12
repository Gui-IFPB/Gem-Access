import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { HttpError } from "../errors/HttpError.js";

const SESSION_DURATION = 8 * 60 * 60 * 1000;

function matchesCredential(candidate, expected) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function createAuthRoutes({
  email = process.env.GEM_ACCESS_ADMIN_EMAIL || "admin@gemaccess.local",
  password = process.env.GEM_ACCESS_ADMIN_PASSWORD || "gemaccess123"
} = {}) {
  const router = Router();
  const sessions = new Map();

  const authenticate = (request, _response, next) => {
    const token = request.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const expiresAt = sessions.get(token);

    if (!token || !expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token);
      return next(new HttpError(401, "UNAUTHORIZED", "Sua sessão expirou. Entre novamente."));
    }

    request.authToken = token;
    return next();
  };

  router.post("/login", (request, response, next) => {
    const { email: submittedEmail, password: submittedPassword } = request.body || {};
    if (typeof submittedEmail !== "string" || typeof submittedPassword !== "string"
      || !matchesCredential(submittedEmail.trim().toLowerCase(), email.toLowerCase())
      || !matchesCredential(submittedPassword, password)) {
      return next(new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos."));
    }

    const token = randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_DURATION);
    return response.json({ token, user: { email } });
  });

  router.post("/logout", authenticate, (request, response) => {
    sessions.delete(request.authToken);
    return response.status(204).end();
  });

  return { router, authenticate };
}

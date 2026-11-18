import { randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { SignJWT, jwtVerify } from "jose";
import { HttpError } from "../errors/HttpError.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { hashPassword, verifyPassword } from "../security/passwords.js";

const TOKEN_DURATION = "8h";
const dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"));
const invalidCredentials = () => new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.");

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function createAuthRoutes({ store, jwtSecret } = {}) {
  if (!store) throw new Error("A store de usuários é obrigatória para autenticação.");

  const configuredSecret = jwtSecret ?? process.env.GEM_ACCESS_JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !configuredSecret) {
    throw new Error("Defina GEM_ACCESS_JWT_SECRET no ambiente de produção.");
  }
  if (configuredSecret && Buffer.byteLength(configuredSecret) < 32) {
    throw new Error("GEM_ACCESS_JWT_SECRET deve ter pelo menos 32 bytes.");
  }

  const secret = new TextEncoder().encode(configuredSecret || randomBytes(32).toString("base64url"));
  const router = Router();
  const revokedTokens = new Map();

  const issueToken = (user) => new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(TOKEN_DURATION)
    .sign(secret);

  const authenticate = async (request, _response, next) => {
    try {
      const authorization = request.get("Authorization") || "";
      const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
      if (!match) throw new Error("Missing bearer token.");

      const { payload } = await jwtVerify(match[1], secret, { algorithms: ["HS256"] });
      if (!payload.sub || !Number.isSafeInteger(Number(payload.sub)) || !payload.jti
        || !Number.isSafeInteger(payload.exp)) {
        throw new Error("Invalid token claims.");
      }

      for (const [jti, expiresAt] of revokedTokens) {
        if (expiresAt <= Date.now()) revokedTokens.delete(jti);
      }
      if (revokedTokens.has(payload.jti)) throw new Error("Revoked token.");

      request.authTokenId = payload.jti;
      request.authTokenExpiresAt = Number(payload.exp) * 1000;
      request.authUserId = Number(payload.sub);
      return next();
    } catch {
      return next(new HttpError(401, "UNAUTHORIZED", "Sua sessão expirou. Entre novamente."));
    }
  };

  router.post("/register", asyncHandler(async (request, response) => {
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some((key) => !["name", "email", "password"].includes(key))) {
      throw new HttpError(400, "VALIDATION_ERROR", "Informe nome, e-mail e senha válidos.");
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = body.password;
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || typeof password !== "string" || password.length < 10 || password.length > 128) {
      throw new HttpError(400, "VALIDATION_ERROR", "Nome, e-mail ou senha inválidos. A senha deve ter de 10 a 128 caracteres.");
    }

    const user = await store.createUserAccount({ name, email, passwordHash: await hashPassword(password) });
    return response.status(201).json({ token: await issueToken(user), user: publicUser(user) });
  }));

  router.post("/login", asyncHandler(async (request, response) => {
    const { email: submittedEmail, password } = request.body || {};
    if (typeof submittedEmail !== "string" || typeof password !== "string") throw invalidCredentials();

    const email = submittedEmail.trim().toLowerCase();
    const user = await store.findUserCredentialsByEmail(email);
    const storedHash = user?.passwordHash ?? await dummyPasswordHash;
    if (!await verifyPassword(password, storedHash) || !user?.passwordHash) throw invalidCredentials();

    return response.json({ token: await issueToken(user), user: publicUser(user) });
  }));

  router.post("/logout", authenticate, (request, response) => {
    revokedTokens.set(request.authTokenId, request.authTokenExpiresAt);
    return response.status(204).end();
  });

  return { router, authenticate };
}

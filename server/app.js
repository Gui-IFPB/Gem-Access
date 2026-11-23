import express from "express";
import { rateLimit } from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { createResourceRouter } from "./routes/resourceRoutes.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createJsonStore } from "./models/jsonStore.js";
import { createPrismaStore } from "./models/prismaStore.js";

export const resources = ["connections", "servers", "users", "alerts", "network"];

function configureCors(request, response, next) {
  const origin = request.get("Origin");
  const configuredOrigins = (process.env.GEM_ACCESS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const isLoopbackOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
  const isAllowedOrigin = origin && (
    (process.env.NODE_ENV !== "production" && isLoopbackOrigin)
    || configuredOrigins.includes(origin)
  );

  if (isAllowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (request.method === "OPTIONS") {
      return response.status(204).end();
    }
  }

  return next();
}

export function createApp({ store = createPrismaStore(), auth = {} } = {}) {
  const app = express();
  const authRoutes = createAuthRoutes({ ...auth, store });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Muitas tentativas de autenticação. Aguarde alguns minutos."
      }
    }
  });

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    return next();
  });
  app.use(configureCors);
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/auth/login", authLimiter);
  app.use("/auth/register", authLimiter);
  app.use("/auth", authRoutes.router);

  for (const resource of resources) {
    app.use(
      `/${resource}`,
      authRoutes.authenticate,
      createResourceRouter(resource, store, authRoutes.requireRole)
    );
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { createResourceRouter } from "./routes/resourceRoutes.js";
import { createJsonStore } from "./models/jsonStore.js";

export const resources = ["connections", "servers", "users", "alerts", "network"];

function developmentCors(request, response, next) {
  const origin = request.get("Origin");
  const isLoopbackOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);

  if (isLoopbackOrigin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      return response.status(204).end();
    }
  }

  return next();
}

export function createApp({ store = createJsonStore() } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(developmentCors);
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_request, response) => response.json({ status: "ok" }));

  for (const resource of resources) {
    app.use(`/${resource}`, createResourceRouter(resource, store));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

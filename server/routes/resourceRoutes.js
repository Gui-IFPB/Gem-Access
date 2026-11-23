import { Router } from "express";
import { createResourceController } from "../controllers/resourceController.js";
import { validateResource } from "../middleware/validateResource.js";

export function createResourceRouter(resource, store, requireRole = () => (_request, _response, next) => next()) {
  const router = Router();
  const controller = createResourceController(resource, store);
  const administratorOnly = requireRole("Administrador");

  router.get("/", controller.list);
  router.post("/", administratorOnly, validateResource(resource), controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", administratorOnly, validateResource(resource, "replace"), controller.replace);
  router.patch("/:id", administratorOnly, validateResource(resource, "patch"), controller.patch);
  router.delete("/:id", administratorOnly, controller.remove);

  return router;
}

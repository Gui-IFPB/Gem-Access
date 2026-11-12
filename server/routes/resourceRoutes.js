import { Router } from "express";
import { createResourceController } from "../controllers/resourceController.js";
import { validateResource } from "../middleware/validateResource.js";

export function createResourceRouter(resource, store) {
  const router = Router();
  const controller = createResourceController(resource, store);

  router.get("/", controller.list);
  router.post("/", validateResource(resource), controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", validateResource(resource, "replace"), controller.replace);
  router.patch("/:id", validateResource(resource, "patch"), controller.patch);
  router.delete("/:id", controller.remove);

  return router;
}

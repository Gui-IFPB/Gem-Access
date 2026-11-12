import { asyncHandler } from "../middleware/asyncHandler.js";

export function createResourceController(resource, store) {
  return {
    list: asyncHandler(async (_request, response) => {
      response.json(await store.list(resource));
    }),

    get: asyncHandler(async (request, response) => {
      response.json(await store.findById(resource, request.params.id));
    }),

    create: asyncHandler(async (request, response) => {
      const record = await store.create(resource, request.validatedBody);
      response.status(201).json(record);
    }),

    replace: asyncHandler(async (request, response) => {
      const record = await store.update(resource, request.params.id, request.validatedBody, { replace: true });
      response.json(record);
    }),

    patch: asyncHandler(async (request, response) => {
      const record = await store.update(resource, request.params.id, request.validatedBody);
      response.json(record);
    }),

    remove: asyncHandler(async (request, response) => {
      await store.remove(resource, request.params.id);
      response.status(204).end();
    })
  };
}

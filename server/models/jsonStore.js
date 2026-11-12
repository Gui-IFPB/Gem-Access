import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HttpError } from "../errors/HttpError.js";

const resourceNames = ["connections", "servers", "users", "alerts", "network"];

export function createJsonStore(filePath = resolve(process.cwd(), "data/db.json")) {
  let operationQueue = Promise.resolve();

  const runExclusive = (operation) => {
    const result = operationQueue.then(operation);
    operationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const readDatabase = async () => {
    try {
      const content = await readFile(filePath, "utf8");
      const database = JSON.parse(content);
      if (!database || typeof database !== "object" || Array.isArray(database)) {
        throw new Error("The data file must contain a JSON object.");
      }
      return database;
    } catch (error) {
      throw new HttpError(500, "PERSISTENCE_ERROR", "Não foi possível ler os dados.", undefined, { cause: error });
    }
  };

  const getResource = (database, resource) => {
    if (!resourceNames.includes(resource) || !Array.isArray(database[resource])) {
      throw new HttpError(500, "PERSISTENCE_ERROR", "O recurso não está configurado no armazenamento.");
    }
    return database[resource];
  };

  const writeDatabase = async (database) => {
    try {
      await writeFile(filePath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
    } catch (error) {
      throw new HttpError(500, "PERSISTENCE_ERROR", "Não foi possível salvar os dados.", undefined, { cause: error });
    }
  };

  return {
    list(resource) {
      return runExclusive(async () => getResource(await readDatabase(), resource));
    },

    findById(resource, id) {
      return runExclusive(async () => {
        const records = getResource(await readDatabase(), resource);
        const record = records.find((item) => String(item.id) === String(id));
        if (!record) {
          throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
        }
        return record;
      });
    },

    create(resource, values) {
      return runExclusive(async () => {
        const database = await readDatabase();
        const records = getResource(database, resource);
        const nextId = records.reduce((maximum, item) => Math.max(maximum, Number(item.id) || 0), 0) + 1;
        const record = { ...values, id: nextId };
        records.push(record);
        await writeDatabase(database);
        return record;
      });
    },

    update(resource, id, values, { replace = false } = {}) {
      return runExclusive(async () => {
        const database = await readDatabase();
        const records = getResource(database, resource);
        const index = records.findIndex((item) => String(item.id) === String(id));
        if (index === -1) {
          throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
        }

        const record = replace
          ? { ...values, id: records[index].id }
          : { ...records[index], ...values, id: records[index].id };
        records[index] = record;
        await writeDatabase(database);
        return record;
      });
    },

    remove(resource, id) {
      return runExclusive(async () => {
        const database = await readDatabase();
        const records = getResource(database, resource);
        const index = records.findIndex((item) => String(item.id) === String(id));
        if (index === -1) {
          throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
        }

        const [record] = records.splice(index, 1);
        await writeDatabase(database);
        return record;
      });
    }
  };
}

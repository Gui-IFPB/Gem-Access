import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HttpError } from "../errors/HttpError.js";

const resourceNames = ["connections", "servers", "users", "alerts", "network"];

const toPublicRecord = (resource, record) => {
  if (resource !== "users") return record;
  const { passwordHash: _passwordHash, ...user } = record;
  return user;
};

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

  const revokedTokens = async () => {
    const database = await readDatabase();
    return Array.isArray(database.revokedTokens) ? database.revokedTokens : [];
  };

  return {
    list(resource) {
      return runExclusive(async () => getResource(await readDatabase(), resource)
        .map((record) => toPublicRecord(resource, record)));
    },

    listVpnSessions(limit = 50) {
      return runExclusive(async () => {
        const database = await readDatabase();
        const records = Array.isArray(database.vpnSessions) ? database.vpnSessions : [];
        return records
          .slice()
          .sort((first, second) => new Date(second.connectedAt) - new Date(first.connectedAt))
          .slice(0, limit);
      });
    },

    syncVpnSessions(sessions, observedAt) {
      return runExclusive(async () => {
        const database = await readDatabase();
        if (!Array.isArray(database.vpnSessions)) database.vpnSessions = [];
        const incomingIds = new Set(sessions.map(({ sourceSessionId }) => sourceSessionId));

        database.vpnSessions = database.vpnSessions.map((record) => (
          record.source === "openvpn-lab"
          && record.disconnectedAt === null
          && !incomingIds.has(record.sourceSessionId)
            ? { ...record, disconnectedAt: observedAt.toISOString(), lastSeenAt: observedAt.toISOString() }
            : record
        ));

        for (const session of sessions) {
          const index = database.vpnSessions.findIndex((record) => record.sourceSessionId === session.sourceSessionId);
          const updated = {
            ...session,
            source: "openvpn-lab",
            connectedAt: session.connectedAt.toISOString(),
            lastSeenAt: observedAt.toISOString(),
            disconnectedAt: null,
            bytesReceived: session.bytesReceived.toString(),
            bytesSent: session.bytesSent.toString()
          };
          if (index === -1) database.vpnSessions.push({ id: database.vpnSessions.length + 1, ...updated });
          else database.vpnSessions[index] = { ...database.vpnSessions[index], ...updated };
        }

        await writeDatabase(database);
        return database.vpnSessions
          .slice()
          .sort((first, second) => new Date(second.connectedAt) - new Date(first.connectedAt))
          .slice(0, 50);
      });
    },

    findById(resource, id) {
      return runExclusive(async () => {
        const records = getResource(await readDatabase(), resource);
        const record = records.find((item) => String(item.id) === String(id));
        if (!record) {
          throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
        }
        return toPublicRecord(resource, record);
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
        return toPublicRecord(resource, record);
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
        return toPublicRecord(resource, record);
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
        return toPublicRecord(resource, record);
      });
    },

    findUserCredentialsByEmail(email) {
      return runExclusive(async () => {
        const users = getResource(await readDatabase(), "users");
        return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
      });
    },

    findUserById(id) {
      return runExclusive(async () => {
        const users = getResource(await readDatabase(), "users");
        const user = users.find((item) => String(item.id) === String(id));
        if (!user) return null;
        return toPublicRecord("users", user);
      });
    },

    createUserAccount({ name, email, passwordHash }) {
      return runExclusive(async () => {
        const database = await readDatabase();
        const users = getResource(database, "users");
        if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
          throw new HttpError(409, "DUPLICATE_RECORD", "Já existe uma conta com esse e-mail.");
        }
        const id = users.reduce((maximum, user) => Math.max(maximum, Number(user.id) || 0), 0) + 1;
        const account = { id, name, email, role: "Usuário", lastConnection: "", passwordHash };
        users.push(account);
        await writeDatabase(database);
        return toPublicRecord("users", account);
      });
    },

    isTokenRevoked(jti) {
      return runExclusive(async () => (await revokedTokens()).some((token) => token.jti === jti
        && new Date(token.expiresAt).getTime() > Date.now()));
    },

    revokeToken(jti, expiresAt) {
      return runExclusive(async () => {
        const database = await readDatabase();
        if (!Array.isArray(database.revokedTokens)) database.revokedTokens = [];
        database.revokedTokens = database.revokedTokens.filter((token) =>
          new Date(token.expiresAt).getTime() > Date.now());
        if (!database.revokedTokens.some((token) => token.jti === jti)) {
          database.revokedTokens.push({ jti, expiresAt: expiresAt.toISOString() });
        }
        await writeDatabase(database);
      });
    }
  };
}

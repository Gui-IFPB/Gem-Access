import { HttpError } from "../errors/HttpError.js";
import { createPrismaClient } from "./prismaClient.js";

const resourceDelegates = {
  connections: "connection",
  servers: "server",
  users: "user",
  alerts: "alert",
  network: "networkComponent"
};

const connectionInclude = { user: { select: { name: true } } };

function toApiRecord(resource, record) {
  if (resource === "users") {
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  }
  if (resource !== "connections") return record;

  const {
    userId: _userId,
    userName,
    sourceCity,
    sourceCountry,
    sourceLatitude,
    sourceLongitude,
    user,
    ...connection
  } = record;

  return {
    ...connection,
    user: user?.name ?? userName,
    ...(sourceCity && sourceCountry ? {
      sourceLocation: {
        city: sourceCity,
        country: sourceCountry,
        latitude: sourceLatitude,
        longitude: sourceLongitude
      }
    } : {})
  };
}

function toDatabaseRecord(resource, values, userId) {
  if (resource !== "connections") return values;

  const { user, sourceLocation, ...connection } = values;
  return {
    ...connection,
    userName: user,
    userId,
    sourceCity: sourceLocation?.city ?? null,
    sourceCountry: sourceLocation?.country ?? null,
    sourceLatitude: sourceLocation?.latitude ?? null,
    sourceLongitude: sourceLocation?.longitude ?? null
  };
}

function toVpnSessionRecord(record) {
  return {
    ...record,
    connectedAt: record.connectedAt.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString(),
    disconnectedAt: record.disconnectedAt?.toISOString() ?? null,
    bytesReceived: record.bytesReceived.toString(),
    bytesSent: record.bytesSent.toString()
  };
}

function recordId(id) {
  const parsedId = Number(id);
  if (!Number.isSafeInteger(parsedId) || parsedId < 1) {
    throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
  }
  return parsedId;
}

function translatePersistenceError(error) {
  if (error instanceof HttpError) return error;
  if (error?.code === "P2025") {
    return new HttpError(404, "NOT_FOUND", "Registro não encontrado.", undefined, { cause: error });
  }
  if (error?.code === "P2002") {
    return new HttpError(409, "DUPLICATE_RECORD", "Já existe um registro com esses dados.", undefined, { cause: error });
  }
  if (error?.code === "P2003") {
    return new HttpError(409, "RELATION_CONFLICT", "A operação viola um relacionamento entre registros.", undefined, { cause: error });
  }
  return new HttpError(500, "PERSISTENCE_ERROR", "Não foi possível acessar os dados.", undefined, { cause: error });
}

export function createPrismaStore({ client = createPrismaClient() } = {}) {
  const delegateFor = (resource) => {
    const delegateName = resourceDelegates[resource];
    if (!delegateName) {
      throw new HttpError(500, "PERSISTENCE_ERROR", "O recurso não está configurado no banco de dados.");
    }
    return client[delegateName];
  };

  const findRecord = (resource, id) => delegateFor(resource).findUnique({
    where: { id: recordId(id) },
    ...(resource === "connections" ? { include: connectionInclude } : {})
  });

  const prepareRecord = async (resource, values) => {
    if (resource !== "connections") return values;
    const relatedUser = await client.user.findFirst({
      where: { name: values.user },
      select: { id: true }
    });
    return toDatabaseRecord(resource, values, relatedUser?.id ?? null);
  };

  const run = async (operation) => {
    try {
      return await operation();
    } catch (error) {
      throw translatePersistenceError(error);
    }
  };

  return {
    list(resource) {
      return run(async () => {
        const records = await delegateFor(resource).findMany({
          orderBy: { id: "asc" },
          ...(resource === "connections" ? { include: connectionInclude } : {})
        });
        return records.map((record) => toApiRecord(resource, record));
      });
    },

    listVpnSessions(limit = 50) {
      return run(async () => {
        const records = await client.vpnSession.findMany({
          orderBy: { connectedAt: "desc" },
          take: limit
        });
        return records.map(toVpnSessionRecord);
      });
    },

    syncVpnSessions(sessions, observedAt) {
      return run(() => client.$transaction(async (transaction) => {
        const activeRecords = await transaction.vpnSession.findMany({
          where: { source: "openvpn-lab", disconnectedAt: null },
          select: { sourceSessionId: true }
        });
        const incomingIds = new Set(sessions.map(({ sourceSessionId }) => sourceSessionId));
        const disconnectedIds = activeRecords
          .map(({ sourceSessionId }) => sourceSessionId)
          .filter((sourceSessionId) => !incomingIds.has(sourceSessionId));

        if (disconnectedIds.length) {
          await transaction.vpnSession.updateMany({
            where: { source: "openvpn-lab", sourceSessionId: { in: disconnectedIds } },
            data: { disconnectedAt: observedAt, lastSeenAt: observedAt }
          });
        }

        for (const session of sessions) {
          const { sourceSessionId, commonName, realAddress, vpnAddress, connectedAt, bytesReceived, bytesSent } = session;
          await transaction.vpnSession.upsert({
            where: { sourceSessionId },
            create: {
              sourceSessionId,
              commonName,
              realAddress,
              vpnAddress,
              connectedAt,
              lastSeenAt: observedAt,
              bytesReceived,
              bytesSent
            },
            update: {
              commonName,
              realAddress,
              vpnAddress,
              lastSeenAt: observedAt,
              disconnectedAt: null,
              bytesReceived,
              bytesSent
            }
          });
        }

        const records = await transaction.vpnSession.findMany({
          orderBy: { connectedAt: "desc" },
          take: 50
        });
        return records.map(toVpnSessionRecord);
      }));
    },

    findById(resource, id) {
      return run(async () => {
        const record = await findRecord(resource, id);
        if (!record) throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
        return toApiRecord(resource, record);
      });
    },

    create(resource, values) {
      return run(async () => {
        const data = await prepareRecord(resource, values);
        const record = await delegateFor(resource).create({
          data,
          ...(resource === "connections" ? { include: connectionInclude } : {})
        });
        return toApiRecord(resource, record);
      });
    },

    update(resource, id, values, { replace = false } = {}) {
      return run(async () => {
        const existing = await findRecord(resource, id);
        if (!existing) throw new HttpError(404, "NOT_FOUND", "Registro não encontrado.");
        const current = toApiRecord(resource, existing);
        const updatedValues = replace ? values : { ...current, ...values };
        const data = await prepareRecord(resource, updatedValues);
        delete data.id;
        const record = await delegateFor(resource).update({
          where: { id: recordId(id) },
          data,
          ...(resource === "connections" ? { include: connectionInclude } : {})
        });
        return toApiRecord(resource, record);
      });
    },

    remove(resource, id) {
      return run(async () => {
        const record = await delegateFor(resource).delete({ where: { id: recordId(id) } });
        return toApiRecord(resource, record);
      });
    },

    findUserCredentialsByEmail(email) {
      return run(() => client.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, role: true, passwordHash: true }
      }));
    },

    findUserById(id) {
      return run(() => client.user.findUnique({
        where: { id: recordId(id) },
        select: { id: true, name: true, email: true, role: true }
      }));
    },

    createUserAccount({ name, email, passwordHash }) {
      return run(async () => toApiRecord("users", await client.user.create({
        data: { name, email, role: "Usuário", passwordHash }
      })));
    },

    isTokenRevoked(jti) {
      return run(async () => {
        await client.revokedToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
        return Boolean(await client.revokedToken.findUnique({ where: { jti } }));
      });
    },

    revokeToken(jti, expiresAt) {
      return run(async () => {
        await client.revokedToken.deleteMany({ where: { expiresAt: { lte: new Date() } } });
        await client.revokedToken.upsert({
          where: { jti },
          update: { expiresAt },
          create: { jti, expiresAt }
        });
      });
    },

    disconnect() {
      return client.$disconnect();
    }
  };
}
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPrismaStore } from "../server/models/prismaStore.js";
import { createPrismaClient } from "../server/models/prismaClient.js";
import { verifyPassword } from "../server/security/passwords.js";
import { seedDatabase } from "../server/seed.js";

const execFile = promisify(execFileCallback);

test("Prisma store applies migrations, seeds data, and enforces persistence constraints", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gem-access-prisma-"));
  const schemaDirectory = join(directory, "prisma");
  const schemaPath = join(schemaDirectory, "schema.prisma");
  const configPath = join(directory, "prisma.config.ts");
  const databasePath = join(directory, "test.sqlite");
  const originalSchemaPath = resolve("prisma/schema.prisma");
  const originalSchema = await readFile(originalSchemaPath, "utf8");
  await mkdir(schemaDirectory);
  await writeFile(schemaPath, originalSchema);
  await writeFile(configPath, [
    'export default { schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" },',
    "  datasource: { url: process.env.DATABASE_URL } };"
  ].join("\n"));
  await cp(join(dirname(originalSchemaPath), "migrations"), join(schemaDirectory, "migrations"), { recursive: true });

  await execFile(process.execPath, [
    resolve("node_modules/prisma/build/index.js"),
    "migrate",
    "deploy",
    "--config",
    configPath
  ], { cwd: directory, env: { ...process.env, DATABASE_URL: `file:${databasePath}` } });

  const client = createPrismaClient({ url: `file:${databasePath}` });
  const store = createPrismaStore({ client });
  t.after(async () => {
    await store.disconnect();
    await rm(directory, { recursive: true, force: true });
  });

  assert.equal(await seedDatabase(client), true);
  assert.equal(await seedDatabase(client), false);
  const seededAdmin = await client.user.findUnique({ where: { email: "admin@gemaccess.local" } });
  assert.match(seededAdmin.passwordHash, /^scrypt\$16384\$/);
  assert.equal(await verifyPassword("gemaccess123", seededAdmin.passwordHash), true);
  assert.equal("passwordHash" in (await store.list("users"))[0], false);
  const seededConnections = await store.list("connections");
  assert.equal(seededConnections.length, 2);
  assert.equal(seededConnections[0].user, "Guilherme");
  assert.equal(seededConnections[0].sourceLocation.city, "Recife");

  const user = await store.create("users", {
    name: "Teste Prisma",
    email: "teste-prisma@gemaccess.local",
    role: "Usuário"
  });
  const server = await store.create("servers", {
    name: "Servidor de teste",
    city: "João Pessoa",
    country: "Brasil",
    status: "online"
  });
  const connection = await store.create("connections", {
    user: user.name,
    vpnIp: "10.8.0.50",
    sourceIp: "192.168.1.50",
    serverId: server.id,
    sourceLocation: { city: "João Pessoa", country: "Brasil", latitude: -7.1, longitude: -34.8 },
    protocol: "WireGuard",
    duration: "00:10:00",
    status: "active",
    traffic: "12 MB"
  });
  assert.equal(connection.user, user.name);
  assert.equal((await store.findById("connections", connection.id)).serverId, server.id);

  const connectedAt = new Date("2026-11-24T18:52:25.000Z");
  const firstObservation = new Date("2026-11-24T18:53:00.000Z");
  const sourceSession = {
    sourceSessionId: "0:0:1795546345:gem-access-demo",
    commonName: "gem-access-demo",
    realAddress: "192.168.56.1:40075",
    vpnAddress: "10.77.0.2",
    connectedAt,
    bytesReceived: 6416n,
    bytesSent: 4401n
  };
  const activeSessions = await store.syncVpnSessions([sourceSession], firstObservation);
  assert.equal(activeSessions[0].commonName, "gem-access-demo");
  assert.equal(activeSessions[0].connectedAt, connectedAt.toISOString());
  assert.equal(activeSessions[0].bytesReceived, "6416");
  assert.equal(activeSessions[0].disconnectedAt, null);

  const nextObservation = new Date("2026-11-24T18:54:00.000Z");
  const updatedSessions = await store.syncVpnSessions([
    { ...sourceSession, bytesReceived: 9000n, bytesSent: 6000n }
  ], nextObservation);
  assert.equal(updatedSessions.length, 1);
  assert.equal(updatedSessions[0].bytesReceived, "9000");
  assert.equal(updatedSessions[0].lastSeenAt, nextObservation.toISOString());

  const disconnectedAt = new Date("2026-11-24T18:55:00.000Z");
  const history = await store.syncVpnSessions([], disconnectedAt);
  assert.equal(history.length, 1);
  assert.equal(history[0].disconnectedAt, disconnectedAt.toISOString());
  assert.equal(history[0].bytesSent, "6000");

  const updated = await store.update("connections", connection.id, { status: "alert" });
  assert.equal(updated.status, "alert");
  const replaced = await store.update("connections", connection.id, {
    user: user.name,
    vpnIp: "10.8.0.51",
    sourceIp: "192.168.1.51",
    serverId: server.id,
    protocol: "OpenVPN",
    duration: "00:20:00",
    status: "offline",
    traffic: "20 MB"
  }, { replace: true });
  assert.equal(replaced.sourceLocation, undefined);

  await assert.rejects(
    store.create("users", { name: "Duplicado", email: user.email, role: "Usuário" }),
    (error) => error.status === 409 && error.code === "DUPLICATE_RECORD"
  );
  await assert.rejects(
    store.remove("servers", server.id),
    (error) => error.status === 409 && error.code === "RELATION_CONFLICT"
  );

  await store.remove("connections", connection.id);
  await store.remove("servers", server.id);
  await store.remove("users", user.id);
  await assert.rejects(
    store.findById("connections", connection.id),
    (error) => error.status === 404 && error.code === "NOT_FOUND"
  );
});
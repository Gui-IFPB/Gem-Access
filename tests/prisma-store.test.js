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
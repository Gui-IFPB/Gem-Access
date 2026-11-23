import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../server/app.js";
import { createJsonStore } from "../server/models/jsonStore.js";

test("resource routes validate input, perform CRUD, and return centralized errors", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gem-access-api-"));
  const dataFile = join(directory, "db.json");
  const fixture = JSON.parse(await readFile(new URL("../data/db.json", import.meta.url), "utf8"));
  await writeFile(dataFile, JSON.stringify(fixture), "utf8");

  const server = createApp({
    store: createJsonStore(dataFile),
    auth: { jwtSecret: "test-secret-with-more-than-thirty-two-bytes" }
  }).listen(0);
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await once(server, "close");
    await rm(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const registrationResponse = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Admin Teste", email: "admin@test.local", password: "test-password" })
  });
  assert.equal(registrationResponse.status, 201);
  const registered = await registrationResponse.json();
  assert.equal(registered.user.email, "admin@test.local");
  assert.equal("passwordHash" in registered.user, false);
  const persistedAccount = JSON.parse(await readFile(dataFile, "utf8")).users.find((user) => user.email === "admin@test.local");
  assert.match(persistedAccount.passwordHash, /^scrypt\$16384\$/);
  persistedAccount.role = "Administrador";
  const database = JSON.parse(await readFile(dataFile, "utf8"));
  const accountIndex = database.users.findIndex((user) => user.email === "admin@test.local");
  database.users[accountIndex].role = "Administrador";
  await writeFile(dataFile, JSON.stringify(database, null, 2), "utf8");
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.local", password: "test-password" })
  });
  assert.equal(loginResponse.status, 200);
  const { token } = await loginResponse.json();
  const authorization = { Authorization: "Bearer " + token };

  const usersResponse = await fetch(`${baseUrl}/users`, { headers: authorization });
  assert.equal(usersResponse.status, 200);
  assert.equal((await usersResponse.json()).some((user) => "passwordHash" in user), false);

  const listResponse = await fetch(`${baseUrl}/connections`, { headers: authorization });
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).length, 2);

  const databaseAfterLogin = JSON.parse(await readFile(dataFile, "utf8"));
  const accountAfterLogin = databaseAfterLogin.users.find((user) => user.email === "admin@test.local");
  accountAfterLogin.role = "Usuário";
  await writeFile(dataFile, JSON.stringify(databaseAfterLogin, null, 2), "utf8");

  const downgradedCreate = await fetch(`${baseUrl}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorization },
    body: JSON.stringify({
      severity: "medium",
      title: "Bloqueado após mudança de perfil",
      description: "O token antigo não deve manter privilégios administrativos.",
      time: "Agora",
      status: "active"
    })
  });
  assert.equal(downgradedCreate.status, 403);
  assert.equal((await downgradedCreate.json()).error.code, "FORBIDDEN");

  accountAfterLogin.role = "Administrador";
  await writeFile(dataFile, JSON.stringify(databaseAfterLogin, null, 2), "utf8");

  const invalidResponse = await fetch(`${baseUrl}/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorization },
    body: JSON.stringify({ user: "Missing fields" })
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error.code, "VALIDATION_ERROR");

  const malformedResponse = await fetch(`${baseUrl}/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorization },
    body: "{"
  });
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).error.code, "INVALID_JSON");

  const createResponse = await fetch(`${baseUrl}/connections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorization },
    body: JSON.stringify({
      user: "Test User",
      sourceIp: "192.168.1.20",
      vpnIp: "10.8.0.20",
      serverId: 1,
      protocol: "WireGuard",
      duration: "00:10:00",
      status: "active",
      traffic: "12 MB"
    })
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.id, 3);

  const replaceResponse = await fetch(`${baseUrl}/connections/${created.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authorization },
    body: JSON.stringify({
      user: "Test User Replaced",
      sourceIp: "192.168.1.21",
      vpnIp: "10.8.0.21",
      serverId: 1,
      protocol: "OpenVPN",
      duration: "00:20:00",
      status: "alert",
      traffic: "20 MB"
    })
  });
  assert.equal(replaceResponse.status, 200);
  assert.equal((await replaceResponse.json()).user, "Test User Replaced");

  const patchResponse = await fetch(`${baseUrl}/connections/${created.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authorization },
    body: JSON.stringify({ status: "offline" })
  });
  assert.equal(patchResponse.status, 200);
  assert.equal((await patchResponse.json()).status, "offline");

  const deleteResponse = await fetch(`${baseUrl}/connections/${created.id}`, { method: "DELETE", headers: authorization });
  assert.equal(deleteResponse.status, 204);

  const notFoundResponse = await fetch(`${baseUrl}/connections/${created.id}`, { headers: authorization });
  assert.equal(notFoundResponse.status, 404);
  assert.equal((await notFoundResponse.json()).error.code, "NOT_FOUND");

  const persisted = JSON.parse(await readFile(dataFile, "utf8"));
  assert.equal(persisted.connections.length, 2);
});

test("resource routes reject missing or invalid session tokens", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gem-access-auth-"));
  const dataFile = join(directory, "db.json");
  const fixture = JSON.parse(await readFile(new URL("../data/db.json", import.meta.url), "utf8"));
  await writeFile(dataFile, JSON.stringify(fixture), "utf8");
  const server = createApp({
    store: createJsonStore(dataFile),
    auth: { jwtSecret: "test-secret-with-more-than-thirty-two-bytes" }
  }).listen(0);
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await once(server, "close");
    await rm(directory, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unauthenticated = await fetch(`${baseUrl}/connections`);
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).error.code, "UNAUTHORIZED");

  const invalidLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.local", password: "wrong-password" })
  });
  assert.equal(invalidLogin.status, 401);
  assert.equal((await invalidLogin.json()).error.code, "INVALID_CREDENTIALS");

  const weakRegistration = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Admin Teste", email: "admin@test.local", password: "short" })
  });
  assert.equal(weakRegistration.status, 400);

  const validLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.local", password: "test-password" })
  });
  assert.equal(validLogin.status, 401);

  const registration = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Admin Teste", email: "admin@test.local", password: "test-password" })
  });
  assert.equal(registration.status, 201);
  const duplicateRegistration = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Admin Teste", email: "ADMIN@test.local", password: "test-password" })
  });
  assert.equal(duplicateRegistration.status, 409);

  const successfulLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.local", password: "test-password" })
  });
  assert.equal(successfulLogin.status, 200);
  const { token } = await successfulLogin.json();
  const authenticated = await fetch(`${baseUrl}/connections`, {
    headers: { Authorization: "Bearer " + token }
  });
  assert.equal(authenticated.status, 200);

  const blockedCreate = await fetch(`${baseUrl}/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      severity: "high",
      title: "Alerta sem permissão",
      description: "Deve ser bloqueado",
      time: "Hoje",
      status: "active"
    })
  });
  assert.equal(blockedCreate.status, 403);
  assert.equal((await blockedCreate.json()).error.code, "FORBIDDEN");

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  });
  assert.equal(logout.status, 204);
  const expiredSession = await fetch(`${baseUrl}/connections`, {
    headers: { Authorization: "Bearer " + token }
  });
  assert.equal(expiredSession.status, 401);
});

test("unknown routes return the API error format", async (t) => {
  const server = createApp().listen(0);
  await once(server, "listening");
  t.after(async () => {
    server.close();
    await once(server, "close");
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/unknown`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "ROUTE_NOT_FOUND", message: "Rota não encontrada." }
  });
});

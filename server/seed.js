import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./models/prismaClient.js";
import { hashPassword } from "./security/passwords.js";

const prisma = createPrismaClient();

export async function seedDatabase(client = prisma) {
  const counts = await Promise.all([
    client.user.count(),
    client.server.count(),
    client.connection.count(),
    client.alert.count(),
    client.networkComponent.count()
  ]);
  const isEmpty = counts.every((count) => count === 0);
  const isProduction = process.env.NODE_ENV === "production";
  const fixture = isEmpty && !isProduction
    ? JSON.parse(await readFile(resolve(process.cwd(), "data/db.json"), "utf8"))
    : null;
  const adminEmail = (process.env.GEM_ACCESS_ADMIN_EMAIL || "admin@gemaccess.local").trim().toLowerCase();
  const adminPassword = process.env.GEM_ACCESS_ADMIN_PASSWORD
    || (process.env.NODE_ENV === "production" ? "" : "gemaccess123");
  if (adminPassword.length < 10 || adminPassword.length > 128) {
    throw new Error("GEM_ACCESS_ADMIN_PASSWORD deve ter de 10 a 128 caracteres.");
  }
  const passwordHash = await hashPassword(adminPassword);

  await client.$transaction(async (transaction) => {
    if (fixture) {
      const fixtureUsers = fixture.users.map((user) => ({ ...user, email: user.email.toLowerCase() }));
      const adminUser = fixtureUsers.find((user) => user.email === adminEmail);
      if (adminUser) adminUser.passwordHash = passwordHash;
      else {
        const nextId = fixtureUsers.reduce((maximum, user) => Math.max(maximum, user.id || 0), 0) + 1;
        fixtureUsers.push({ id: nextId, name: "Administrador", email: adminEmail, role: "Administrador", passwordHash });
      }

      await transaction.user.createMany({ data: fixtureUsers });
      await transaction.server.createMany({ data: fixture.servers });

      const users = await transaction.user.findMany({ select: { id: true, name: true } });
      const userIdsByName = new Map(users.map((user) => [user.name, user.id]));
      await transaction.connection.createMany({
        data: fixture.connections.map(({ user, sourceLocation, ...connection }) => ({
          ...connection,
          userName: user,
          userId: userIdsByName.get(user) ?? null,
          sourceCity: sourceLocation?.city ?? null,
          sourceCountry: sourceLocation?.country ?? null,
          sourceLatitude: sourceLocation?.latitude ?? null,
          sourceLongitude: sourceLocation?.longitude ?? null
        }))
      });
      await transaction.alert.createMany({ data: fixture.alerts });
      await transaction.networkComponent.createMany({ data: fixture.network });
      return;
    }

    const adminUser = await transaction.user.findUnique({ where: { email: adminEmail } });
    if (adminUser) {
      await transaction.user.update({ where: { id: adminUser.id }, data: { passwordHash } });
    } else if (!adminUser) {
      await transaction.user.create({
        data: { name: "Administrador", email: adminEmail, role: "Administrador", passwordHash }
      });
    }

    const missingServer = !isProduction
      ? await transaction.server.findUnique({ where: { id: 1 } })
      : null;
    if (!isProduction && !missingServer) {
      const fixture = JSON.parse(await readFile(resolve(process.cwd(), "data/db.json"), "utf8"));
      const server = fixture.servers.find((item) => item.id === 1);
      if (server) await transaction.server.create({ data: server });
    }
  });
  return isEmpty;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const seeded = await seedDatabase();
    console.log(seeded ? "Dados iniciais importados." : "Banco existente verificado; dados demonstrativos preservados.");
  } finally {
    await prisma.$disconnect();
  }
}
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./models/prismaClient.js";

const prisma = createPrismaClient();

export async function seedDatabase(client = prisma) {
  const counts = await Promise.all([
    client.user.count(),
    client.server.count(),
    client.connection.count(),
    client.alert.count(),
    client.networkComponent.count()
  ]);
  if (counts.some((count) => count > 0)) return false;

  const fixture = JSON.parse(await readFile(resolve(process.cwd(), "data/db.json"), "utf8"));
  await client.$transaction(async (transaction) => {
    await transaction.user.createMany({ data: fixture.users });
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
  });
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const seeded = await seedDatabase();
    console.log(seeded ? "Dados iniciais importados." : "Banco já possui dados; carga inicial ignorada.");
  } finally {
    await prisma.$disconnect();
  }
}
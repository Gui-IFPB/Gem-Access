import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

export function createPrismaClient({
  url = process.env.DATABASE_URL ?? `file:${resolve(process.cwd(), "data/gem-access.sqlite")}`
} = {}) {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
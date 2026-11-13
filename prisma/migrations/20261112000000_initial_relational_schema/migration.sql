CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "lastConnection" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE "servers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "status" TEXT NOT NULL
);

CREATE TABLE "connections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "userName" TEXT NOT NULL,
    "vpnIp" TEXT NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "serverId" INTEGER NOT NULL,
    "sourceCity" TEXT,
    "sourceCountry" TEXT,
    "sourceLatitude" REAL,
    "sourceLongitude" REAL,
    "protocol" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "traffic" TEXT NOT NULL,
    CONSTRAINT "connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "connections_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "alerts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

CREATE TABLE "network" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "connections_userId_idx" ON "connections"("userId");
CREATE INDEX "connections_serverId_idx" ON "connections"("serverId");
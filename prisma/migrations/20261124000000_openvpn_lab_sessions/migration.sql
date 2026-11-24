CREATE TABLE "vpn_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceSessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'openvpn-lab',
    "commonName" TEXT NOT NULL,
    "realAddress" TEXT NOT NULL,
    "vpnAddress" TEXT NOT NULL,
    "connectedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "disconnectedAt" DATETIME,
    "bytesReceived" BIGINT NOT NULL DEFAULT 0,
    "bytesSent" BIGINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "vpn_sessions_sourceSessionId_key" ON "vpn_sessions"("sourceSessionId");
CREATE INDEX "vpn_sessions_source_disconnectedAt_idx" ON "vpn_sessions"("source", "disconnectedAt");
CREATE INDEX "vpn_sessions_connectedAt_idx" ON "vpn_sessions"("connectedAt");

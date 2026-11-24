import test from "node:test";
import assert from "node:assert/strict";
import { parseOpenVpnStatus } from "../server/vpn/openVpnStatusParser.js";
import { createOpenVpnLabCollector } from "../server/vpn/openVpnLabCollector.js";

const statusWithClient = [
  "TITLE,OpenVPN 2.5.11",
  "TIME,2026-11-24 18:53:46,1795546426",
  "HEADER,CLIENT_LIST,Common Name,Real Address,Virtual Address,Virtual IPv6 Address,Bytes Received,Bytes Sent,Connected Since,Connected Since (time_t),Username,Client ID,Peer ID,Data Channel Cipher",
  'CLIENT_LIST,"demo, client",192.168.56.1:40075,10.77.0.2,,6416,4401,2026-11-24 18:52:25,1795546345,UNDEF,0,0,AES-256-GCM',
  "HEADER,ROUTING_TABLE,Virtual Address,Common Name,Real Address,Last Ref,Last Ref (time_t)",
  "ROUTING_TABLE,10.77.0.2,\"demo, client\",192.168.56.1:40075,2026-11-24 18:53:40,1795546420",
  "GLOBAL_STATS,Max bcast/mcast queue length,1",
  "END"
].join("\n");

test("OpenVPN status parser normalizes active client and byte counters", () => {
  const [session] = parseOpenVpnStatus(statusWithClient);

  assert.equal(session.sourceSessionId, "0:0:1795546345:demo, client");
  assert.equal(session.commonName, "demo, client");
  assert.equal(session.realAddress, "192.168.56.1:40075");
  assert.equal(session.vpnAddress, "10.77.0.2");
  assert.equal(session.connectedAt.toISOString(), "2026-11-24T18:52:25.000Z");
  assert.equal(session.bytesReceived, 6416n);
  assert.equal(session.bytesSent, 4401n);
});

test("OpenVPN status parser accepts an empty but complete client list", () => {
  const emptyStatus = statusWithClient
    .replace(/^CLIENT_LIST,.*\n/m, "")
    .replace("END", "END");
  assert.deepEqual(parseOpenVpnStatus(emptyStatus), []);
});

test("OpenVPN status parser rejects incomplete or malformed snapshots", () => {
  assert.throws(() => parseOpenVpnStatus(""), /vazio/);
  assert.throws(() => parseOpenVpnStatus("HEADER,CLIENT_LIST,Common Name"), /incompleto/);
  assert.throws(() => parseOpenVpnStatus(statusWithClient.replace("6416,4401", "invalid,4401")), /Contador inválido/);
});

test("OpenVPN collector syncs only parsed snapshots and reports unavailable on command errors", async () => {
  const synchronized = [];
  const errors = [];
  const collector = createOpenVpnLabCollector({
    store: {
      async syncVpnSessions(sessions, observedAt) {
        synchronized.push({ sessions, observedAt });
      }
    },
    runCommand: async (command, args, options) => {
      assert.equal(command, "vagrant");
      assert.deepEqual(args.slice(0, 3), ["ssh", "openvpn-lab", "--"]);
      assert.match(options.cwd, /lab\/openvpn$/);
      return { stdout: statusWithClient };
    },
    logger: { error: (...args) => errors.push(args) }
  });

  await collector.pollOnce();
  assert.equal(collector.getStatus().status, "active");
  assert.equal(synchronized.length, 1);
  assert.equal(synchronized[0].sessions.length, 1);

  const failedCollector = createOpenVpnLabCollector({
    store: { async syncVpnSessions() { assert.fail("Invalid snapshots must not be persisted."); } },
    runCommand: async () => { throw new Error("VM unavailable"); },
    logger: { error: (...args) => errors.push(args) }
  });
  await failedCollector.pollOnce();
  assert.equal(failedCollector.getStatus().status, "unavailable");
  assert.equal(errors.length, 1);
});

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { parseOpenVpnStatus } from "./openVpnStatusParser.js";

const execFile = promisify(execFileCallback);
const POLL_INTERVAL_MS = 5000;
const STATUS_FILE = "/var/log/openvpn/status.log";

export function createOpenVpnLabCollector({
  store,
  runCommand = execFile,
  projectDirectory = process.cwd(),
  intervalMs = POLL_INTERVAL_MS,
  logger = console
} = {}) {
  if (!store || typeof store.syncVpnSessions !== "function") {
    throw new Error("O armazenamento precisa implementar syncVpnSessions para a coleta OpenVPN.");
  }

  const state = {
    enabled: true,
    status: "unavailable",
    lastPollAt: null
  };
  let timer;
  let polling = false;

  const pollOnce = async () => {
    if (polling) return;
    polling = true;
    try {
      const { stdout } = await runCommand(
        "vagrant",
        ["ssh", "openvpn-lab", "--", "sudo", "cat", STATUS_FILE],
        {
          cwd: resolve(projectDirectory, "lab/openvpn"),
          timeout: 10_000,
          maxBuffer: 1024 * 1024
        }
      );
      const sessions = parseOpenVpnStatus(stdout);
      await store.syncVpnSessions(sessions, new Date());
      state.status = sessions.length ? "active" : "idle";
      state.lastPollAt = new Date().toISOString();
    } catch (error) {
      state.status = "unavailable";
      logger.error("Falha na coleta do status OpenVPN local:", error);
    } finally {
      polling = false;
    }
  };

  return {
    start() {
      if (process.env.NODE_ENV === "production") {
        throw new Error("A coleta via Vagrant só pode ser habilitada em desenvolvimento.");
      }
      if (timer) return;
      void pollOnce();
      timer = setInterval(() => void pollOnce(), intervalMs);
      timer.unref?.();
    },

    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },

    pollOnce,

    getStatus() {
      return { ...state };
    }
  };
}

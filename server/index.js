import "dotenv/config";
import { createApp } from "./app.js";
import { createOpenVpnLabCollector } from "./vpn/openVpnLabCollector.js";
import { createPrismaStore } from "./models/prismaStore.js";

const port = Number(process.env.PORT) || 3000;
if (process.env.GEM_ACCESS_OPENVPN_LAB_ENABLED === "true" && process.env.NODE_ENV === "production") {
  throw new Error("GEM_ACCESS_OPENVPN_LAB_ENABLED só pode ser usado fora de produção.");
}
const store = createPrismaStore();
const vpnLabCollector = process.env.GEM_ACCESS_OPENVPN_LAB_ENABLED === "true"
  ? createOpenVpnLabCollector({ store })
  : null;
const app = createApp({ store, vpnLabCollector });
const server = app.listen(port, () => {
  console.log(`GEM Access API disponível em http://localhost:${port}`);
});

vpnLabCollector?.start();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    vpnLabCollector?.stop();
    server.close(async (error) => {
      if (error) {
        console.error("Falha ao encerrar o servidor HTTP:", error);
        process.exitCode = 1;
      }
      try {
        await store.disconnect();
      } catch (disconnectError) {
        console.error("Falha ao encerrar a conexão Prisma:", disconnectError);
        process.exitCode = 1;
      }
    });
  });
}

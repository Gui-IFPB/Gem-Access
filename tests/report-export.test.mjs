import assert from "node:assert/strict";
import test from "node:test";
import { buildConnectionReportCsv } from "../assets/js/reportExport.js";

test("connection report CSV includes a spreadsheet-friendly header and values", () => {
  const csv = buildConnectionReportCsv([{
    user: "Usuário; exemplo",
    vpnIp: "10.77.0.2",
    sourceIp: "192.168.56.1",
    protocol: "OpenVPN",
    duration: "00:10:00",
    traffic: "15 kB",
    status: "active"
  }]);

  assert.match(csv, /^\uFEFF"Usuário";"IP VPN";"IP de origem"/);
  assert.match(csv, /"Usuário; exemplo";"10\.77\.0\.2";"192\.168\.56\.1"/);
  assert.match(csv, /"OpenVPN";"00:10:00";"15 kB";"Ativo"/);
});

test("connection report CSV escapes quotes and neutralizes spreadsheet formulas", () => {
  const csv = buildConnectionReportCsv([{
    user: '=HYPERLINK("https://example.test")',
    vpnIp: "10.77.0.2",
    sourceIp: "192.168.56.1",
    protocol: "OpenVPN",
    duration: "00:10:00",
    traffic: "15 kB",
    status: "active"
  }]);

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/);
});

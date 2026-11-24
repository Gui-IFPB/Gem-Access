const columns = [
  "Usuário",
  "IP VPN",
  "IP de origem",
  "Protocolo",
  "Duração",
  "Tráfego",
  "Estado"
];
const statusLabels = { active: "Ativo", alert: "Alerta", offline: "Offline" };

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function buildConnectionReportCsv(connections) {
  const rows = [
    columns,
    ...connections.map((connection) => [
      connection.user,
      connection.vpnIp,
      connection.sourceIp,
      connection.protocol,
      connection.duration,
      connection.traffic,
      statusLabels[connection.status] ?? connection.status
    ])
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function downloadConnectionReport(connections) {
  const blob = new Blob([buildConnectionReportCsv(connections)], {
    type: "text/csv;charset=utf-8"
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `gem-access-conexoes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

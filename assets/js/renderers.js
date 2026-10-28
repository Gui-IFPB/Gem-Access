import { escapeHtml, statusTag, showTableMessage, trafficToMb, formatTraffic, formatDuration, durationToSeconds } from './utils.js';

export function renderConnectionRows(connections, table, limit = Infinity) {
  if (!table) return;

  if (!connections.length) {
    showTableMessage(table, "Nenhuma conexão encontrada.", table.dataset.columns || 6);
    return;
  }

  table.innerHTML = connections.slice(0, limit).map((connection) => `
    <tr>
      <td>${escapeHtml(connection.user || "--")}</td>
      ${table.dataset.compact === "true" ? "" : `<td>${escapeHtml(connection.sourceIp || "--")}</td>`}
      <td>${escapeHtml(connection.vpnIp || "--")}</td>
      <td>${escapeHtml(connection.protocol || "--")}</td>
      <td>${escapeHtml(connection.duration || "--")}</td>
      <td>${escapeHtml(connection.traffic || "--")}</td>
      <td>${statusTag(connection.status)}</td>
    </tr>
  `).join("");
}

export function renderBreakdown(items, key, chart, labels, valueForItem) {
  if (!chart || !labels) return;

  const totals = new Map();
  items.forEach((item) => {
    const label = item[key] || "Não informado";
    totals.set(label, (totals.get(label) || 0) + valueForItem(item));
  });

  const entries = [...totals.entries()].sort((first, second) => second[1] - first[1]);

  if (!entries.length) {
    chart.innerHTML = "<p>Nenhum dado disponível.</p>";
    labels.replaceChildren();
    return;
  }

  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  chart.innerHTML = entries.map(([label, value]) =>
    `<i title="${escapeHtml(label)}: ${escapeHtml(value)}" style="height:${Math.max(8, (value / maximum) * 100)}%"></i>`
  ).join("");
  labels.innerHTML = entries.map(([label]) => `<span>${escapeHtml(label)}</span>`).join("");
}

export function renderDashboard({ connections, alerts, network }) {
  const activeConnections = connections.filter((connection) => connection.status === "active");
  const activeAlerts = alerts.filter((alert) => alert.status === "active");

  const activeConnectionsElement = document.getElementById("active-connections");
  const connectedUsersElement = document.getElementById("connected-users");
  const totalTrafficElement = document.getElementById("total-traffic");
  const activeAlertsElement = document.getElementById("active-alerts");

  if (activeConnectionsElement) activeConnectionsElement.textContent = activeConnections.length;
  if (connectedUsersElement) connectedUsersElement.textContent = new Set(activeConnections.map((connection) => connection.user)).size;
  if (totalTrafficElement) totalTrafficElement.textContent = formatTraffic(connections.reduce((total, connection) => total + trafficToMb(connection.traffic), 0));
  if (activeAlertsElement) activeAlertsElement.textContent = activeAlerts.length;

  updateAlertsBadge(alerts);
  renderBreakdown(connections, "protocol", document.getElementById("dashboard-chart"), document.getElementById("dashboard-chart-labels"), () => 1);

  const networkList = document.getElementById("network-status");
  if (networkList) {
    networkList.innerHTML = network.length
      ? network.map((item) => `
          <div>
            <span><i class="status-dot ${item.status === "warning" ? "orange" : ""}"></i> ${escapeHtml(item.name)}</span>
            <strong>${item.status === "online" ? "Online" : item.status === "warning" ? "Atenção" : "Offline"}</strong>
          </div>
        `).join("")
      : "<p>Nenhum componente cadastrado.</p>";
  }

  renderConnectionRows(connections.slice().reverse(), document.getElementById("dashboard-connections"), 5);
}

export function renderUsers({ users, connections }) {
  const table = document.getElementById("users-table");
  const search = document.getElementById("user-search");

  const render = () => {
    const query = search.value.trim().toLocaleLowerCase("pt-BR");
    const filteredUsers = users.filter((user) => [user.name, user.email, user.role]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query)));

    if (!filteredUsers.length) {
      showTableMessage(table, "Nenhum usuário encontrado.", 5);
      return;
    }

    table.innerHTML = filteredUsers.map((user) => {
      const isOnline = connections.some((connection) => connection.status === "active" && connection.user?.toLocaleLowerCase("pt-BR") === user.name?.toLocaleLowerCase("pt-BR"));
      return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td><td>${escapeHtml(user.lastConnection || "--")}</td><td>${statusTag(isOnline ? "online" : "offline")}</td></tr>`;
    }).join("");
  };

  if (search) {
    search.addEventListener("input", render);
  }

  render();
}

export function renderAlerts(alerts) {
  const list = document.getElementById("alert-list");
  if (!alerts.length) {
    list.innerHTML = "<p>Nenhum alerta cadastrado.</p>";
    return;
  }

  list.innerHTML = alerts.slice().reverse().map((alert) => {
    const severity = ["critical", "high", "medium"].includes(alert.severity) ? alert.severity : "medium";
    const labels = { critical: "CRÍTICO", high: "ALTO", medium: "MÉDIO" };
    return `<article class="alert-card ${severity}"><div class="alert-icon">!</div><div><span class="alert-level">${labels[severity]}</span><h2>${escapeHtml(alert.title)}</h2><p>${escapeHtml(alert.description)}</p><small>${escapeHtml(alert.time || "")}</small> ${alert.status === "active" ? "" : statusTag("resolved")}</div></article>`;
  }).join("");
}

export function renderReports({ connections, alerts }) {
  const connectionCount = document.getElementById("report-connections");
  const trafficElement = document.getElementById("report-traffic");
  const durationElement = document.getElementById("report-duration");
  const alertsElement = document.getElementById("report-alerts");

  if (connectionCount) connectionCount.textContent = connections.length;

  const totalTraffic = connections.reduce((total, connection) => total + trafficToMb(connection.traffic), 0);
  if (trafficElement) trafficElement.textContent = formatTraffic(totalTraffic);

  const averageDuration = connections.length
    ? connections.reduce((total, connection) => total + durationToSeconds(connection.duration), 0) / connections.length
    : 0;
  if (durationElement) durationElement.textContent = formatDuration(averageDuration);
  if (alertsElement) alertsElement.textContent = alerts.length;

  renderBreakdown(connections, "protocol", document.getElementById("report-chart"), document.getElementById("report-chart-labels"), (connection) => trafficToMb(connection.traffic));

  const trafficByUser = new Map();
  connections.forEach((connection) => {
    const name = connection.user || "Não informado";
    trafficByUser.set(name, (trafficByUser.get(name) || 0) + trafficToMb(connection.traffic));
  });

  const ranking = document.getElementById("user-ranking");
  const entries = [...trafficByUser.entries()].sort((first, second) => second[1] - first[1]);
  ranking.innerHTML = entries.length
    ? entries.map(([name, traffic], index) => `<div><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(name)}</span><strong>${formatTraffic(traffic)}</strong></div>`).join("")
    : "<p>Nenhum dado disponível.</p>";
}

let locationMap;
let locationLayers;

export function renderLocations({ connections, servers }) {
  const mapElement = document.getElementById("location-map");
  const sessionList = document.getElementById("location-sessions");
  const activeConnections = connections.filter((connection) => connection.status === "active");
  const serverById = new Map(servers.map((server) => [String(server.id), server]));
  const mapStatus = document.getElementById("location-map-status");
  const activeCount = document.getElementById("location-active-count");

  if (activeCount) activeCount.textContent = activeConnections.length;

  if (!window.L) {
    if (mapStatus) mapStatus.textContent = "Não foi possível carregar o mapa. Verifique sua conexão.";
    return;
  }

  if (!locationMap) {
    locationMap = L.map(mapElement, { minZoom: 2, maxZoom: 12, worldCopyJump: true }).setView([15, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(locationMap);
    locationLayers = L.layerGroup().addTo(locationMap);
  }

  locationLayers.clearLayers();
  const plottedServers = new Set();
  const plottedLocations = [];
  const pointIcon = (kind) => L.divIcon({
    className: "location-marker-wrap",
    html: `<span class="location-marker ${kind}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  const hasCoordinates = (location) => Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));

  servers.forEach((server) => {
    if (!hasCoordinates(server)) return;
    const coordinates = [Number(server.latitude), Number(server.longitude)];
    L.marker(coordinates, { icon: pointIcon("server-marker") })
      .bindPopup(`<strong>${escapeHtml(server.name)}</strong><br>${escapeHtml(server.city)}, ${escapeHtml(server.country)}<br>Servidor VPN`)
      .addTo(locationLayers);
    plottedServers.add(String(server.id));
    plottedLocations.push(coordinates);
  });

  if (sessionList) {
    sessionList.innerHTML = activeConnections.length
      ? activeConnections.map((connection) => {
          const origin = connection.sourceLocation;
          const server = serverById.get(String(connection.serverId));
          const originLabel = origin?.city && origin?.country ? `${escapeHtml(origin.city)}, ${escapeHtml(origin.country)}` : "Localização indisponível";
          const serverLabel = server?.city && server?.country ? `${escapeHtml(server.city)}, ${escapeHtml(server.country)}` : "Servidor sem localização cadastrada";

          if (hasCoordinates(origin)) {
            const originCoordinates = [Number(origin.latitude), Number(origin.longitude)];
            L.marker(originCoordinates, { icon: pointIcon("user-marker") })
              .bindPopup(`<strong>${escapeHtml(connection.user)}</strong><br>${originLabel}<br>IP de origem: ${escapeHtml(connection.sourceIp)}`)
              .addTo(locationLayers);
            plottedLocations.push(originCoordinates);
            if (server && hasCoordinates(server)) {
              L.polyline([originCoordinates, [Number(server.latitude), Number(server.longitude)]], {
                color: "#287a62",
                weight: 2,
                opacity: 0.65,
                dashArray: "5 7"
              }).addTo(locationLayers);
            }
          }

          if (server && !plottedServers.has(String(server.id)) && hasCoordinates(server)) {
            L.marker([Number(server.latitude), Number(server.longitude)], { icon: pointIcon("server-marker") })
              .bindPopup(`<strong>${escapeHtml(server.name)}</strong><br>${serverLabel}<br>Servidor VPN`)
              .addTo(locationLayers);
            plottedServers.add(String(server.id));
          }

          return `<li><strong>${escapeHtml(connection.user)}</strong><span>Origem: ${originLabel}</span><span>Servidor: ${serverLabel}</span></li>`;
        }).join("")
      : "<li class=\"location-empty\">Nenhuma sessão VPN ativa.</li>";
  }

  if (mapStatus) mapStatus.textContent = "Dados demonstrativos. As coordenadas de origem representam uma estimativa por IP.";
  const locationUpdated = document.getElementById("location-updated");
  if (locationUpdated) locationUpdated.textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  requestAnimationFrame(() => locationMap.invalidateSize());
}

export function updateAlertsBadge(alerts) {
  const badge = document.getElementById("alerts-badge");
  if (!badge) return;
  badge.textContent = alerts.filter((alert) => alert.status === "active").length;
}

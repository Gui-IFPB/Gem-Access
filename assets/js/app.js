const API_BASE_URL = "http://localhost:3000";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

window.GemAccess = { escapeHtml };

async function loadResource(resource) {
  const response = await fetch(`${API_BASE_URL}/${resource}`);
  if (!response.ok) throw new Error(`Falha ao carregar ${resource}.`);
  return response.json();
}

function updateAlertsBadge(alerts) {
  const badge = document.getElementById("alerts-badge");
  if (!badge) return;
  badge.textContent = alerts.filter(alert => alert.status === "active").length;
}

function showTableMessage(table, message, columns) {
  if (table) table.innerHTML = `<tr><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function trafficToMb(traffic) {
  const match = String(traffic || "").match(/([\d.,]+)\s*(B|KB|MB|GB|TB)?/i);
  if (!match) return 0;
  const amount = Number(match[1].replace(",", "."));
  const unit = (match[2] || "MB").toUpperCase();
  const factors = { B: 1 / 1000000, KB: 1 / 1000, MB: 1, GB: 1000, TB: 1000000 };
  return amount * (factors[unit] || 1);
}

function formatTraffic(mb) {
  if (mb >= 1000) return `${(mb / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} MB`;
}

function durationToSeconds(duration) {
  const parts = String(duration || "").split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`;
}

function statusTag(status) {
  const states = {
    active: ["success", "Ativo"],
    alert: ["warning", "Alerta"],
    online: ["success", "Online"],
    offline: ["neutral", "Offline"],
    resolved: ["neutral", "Resolvido"]
  };
  const [className, label] = states[status] || ["neutral", status || "Indefinido"];
  return `<span class="tag ${className}">${escapeHtml(label)}</span>`;
}

function renderConnectionRows(connections, table, limit = Infinity) {
  if (!table) return;
  if (!connections.length) {
    showTableMessage(table, "Nenhuma conexão encontrada.", table.dataset.columns || 6);
    return;
  }

  table.innerHTML = connections.slice(0, limit).map(connection => `
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

function renderBreakdown(items, key, chart, labels, valueForItem) {
  if (!chart || !labels) return;
  const totals = new Map();
  items.forEach(item => {
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
    `<i title="${escapeHtml(label)}: ${escapeHtml(value)}" style="height:${Math.max(8, value / maximum * 100)}%"></i>`
  ).join("");
  labels.innerHTML = entries.map(([label]) => `<span>${escapeHtml(label)}</span>`).join("");
}

function renderDashboard({ connections, alerts, network }) {
  const activeConnections = connections.filter(connection => connection.status === "active");
  const activeAlerts = alerts.filter(alert => alert.status === "active");
  document.getElementById("active-connections").textContent = activeConnections.length;
  document.getElementById("connected-users").textContent = new Set(activeConnections.map(connection => connection.user)).size;
  document.getElementById("total-traffic").textContent = formatTraffic(connections.reduce((total, connection) => total + trafficToMb(connection.traffic), 0));
  document.getElementById("active-alerts").textContent = activeAlerts.length;
  updateAlertsBadge(alerts);
  renderBreakdown(connections, "protocol", document.getElementById("dashboard-chart"), document.getElementById("dashboard-chart-labels"), () => 1);

  const networkList = document.getElementById("network-status");
  networkList.innerHTML = network.map(item => `
    <div><span><i class="status-dot ${item.status === "warning" ? "orange" : ""}"></i> ${escapeHtml(item.name)}</span>
    <strong>${item.status === "online" ? "Online" : item.status === "warning" ? "Atenção" : "Offline"}</strong></div>
  `).join("") || "<p>Nenhum componente cadastrado.</p>";

  renderConnectionRows(connections.slice().reverse(), document.getElementById("dashboard-connections"), 5);
}

function renderUsers({ users, connections }) {
  const table = document.getElementById("users-table");
  const search = document.getElementById("user-search");
  const render = () => {
    const query = search.value.trim().toLocaleLowerCase("pt-BR");
    const filteredUsers = users.filter(user => [user.name, user.email, user.role]
      .some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(query)));
    if (!filteredUsers.length) {
      showTableMessage(table, "Nenhum usuário encontrado.", 5);
      return;
    }
    table.innerHTML = filteredUsers.map(user => {
      const isOnline = connections.some(connection =>
        connection.status === "active" && connection.user?.toLocaleLowerCase("pt-BR") === user.name?.toLocaleLowerCase("pt-BR"));
      return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td><td>${escapeHtml(user.lastConnection || "--")}</td><td>${statusTag(isOnline ? "online" : "offline")}</td></tr>`;
    }).join("");
  };
  search.oninput = render;
  render();
}

function renderAlerts(alerts) {
  const list = document.getElementById("alert-list");
  if (!alerts.length) {
    list.innerHTML = "<p>Nenhum alerta cadastrado.</p>";
    return;
  }
  list.innerHTML = alerts.slice().reverse().map(alert => {
    const severity = ["critical", "high", "medium"].includes(alert.severity) ? alert.severity : "medium";
    const labels = { critical: "CRÍTICO", high: "ALTO", medium: "MÉDIO" };
    return `<article class="alert-card ${severity}"><div class="alert-icon">!</div><div><span class="alert-level">${labels[severity]}</span><h2>${escapeHtml(alert.title)}</h2><p>${escapeHtml(alert.description)}</p><small>${escapeHtml(alert.time || "")}</small> ${alert.status === "active" ? "" : statusTag("resolved")}</div></article>`;
  }).join("");
}

function renderReports({ connections, alerts }) {
  document.getElementById("report-connections").textContent = connections.length;
  const totalTraffic = connections.reduce((total, connection) => total + trafficToMb(connection.traffic), 0);
  document.getElementById("report-traffic").textContent = formatTraffic(totalTraffic);
  const averageDuration = connections.length
    ? connections.reduce((total, connection) => total + durationToSeconds(connection.duration), 0) / connections.length
    : 0;
  document.getElementById("report-duration").textContent = formatDuration(averageDuration);
  document.getElementById("report-alerts").textContent = alerts.length;

  renderBreakdown(connections, "protocol", document.getElementById("report-chart"), document.getElementById("report-chart-labels"), connection => trafficToMb(connection.traffic));

  const trafficByUser = new Map();
  connections.forEach(connection => {
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

function renderLocations({ connections, servers }) {
  const mapElement = document.getElementById("location-map");
  const sessionList = document.getElementById("location-sessions");
  const activeConnections = connections.filter(connection => connection.status === "active");
  const serverById = new Map(servers.map(server => [String(server.id), server]));
  const mapStatus = document.getElementById("location-map-status");

  document.getElementById("location-active-count").textContent = activeConnections.length;
  if (!window.L) {
    mapStatus.textContent = "Não foi possível carregar o mapa. Verifique sua conexão.";
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
  const pointIcon = kind => L.divIcon({
    className: "location-marker-wrap",
    html: `<span class="location-marker ${kind}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
  const hasCoordinates = location => Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));

  servers.forEach(server => {
    if (!hasCoordinates(server)) return;
    const coordinates = [Number(server.latitude), Number(server.longitude)];
    L.marker(coordinates, { icon: pointIcon("server-marker") })
      .bindPopup(`<strong>${escapeHtml(server.name)}</strong><br>${escapeHtml(server.city)}, ${escapeHtml(server.country)}<br>Servidor VPN`)
      .addTo(locationLayers);
    plottedServers.add(String(server.id));
    plottedLocations.push(coordinates);
  });

  sessionList.innerHTML = activeConnections.length
    ? activeConnections.map(connection => {
      const origin = connection.sourceLocation;
      const server = serverById.get(String(connection.serverId));
      const originLabel = origin?.city && origin?.country
        ? `${escapeHtml(origin.city)}, ${escapeHtml(origin.country)}`
        : "Localização indisponível";
      const serverLabel = server?.city && server?.country
        ? `${escapeHtml(server.city)}, ${escapeHtml(server.country)}`
        : "Servidor sem localização cadastrada";

      if (hasCoordinates(origin)) {
        const originCoordinates = [Number(origin.latitude), Number(origin.longitude)];
        L.marker(originCoordinates, { icon: pointIcon("user-marker") })
          .bindPopup(`<strong>${escapeHtml(connection.user)}</strong><br>${originLabel}<br>IP de origem: ${escapeHtml(connection.sourceIp)}`)
          .addTo(locationLayers);
        plottedLocations.push(originCoordinates);
        if (server && hasCoordinates(server)) {
          L.polyline([originCoordinates, [Number(server.latitude), Number(server.longitude)]], {
            color: "#287a62", weight: 2, opacity: 0.65, dashArray: "5 7"
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

  mapStatus.textContent = "Dados demonstrativos. As coordenadas de origem representam uma estimativa por IP.";
  document.getElementById("location-updated").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  requestAnimationFrame(() => locationMap.invalidateSize());
}

async function loadPage() {
  const page = document.body.dataset.page;
  try {
    if (page === "connections") {
      updateAlertsBadge(await loadResource("alerts"));
      return;
    }
    const resources = {
      dashboard: ["connections", "alerts", "network"],
      users: ["users", "connections", "alerts"],
      alerts: ["alerts"],
      reports: ["connections", "alerts"],
      locations: ["connections", "servers", "alerts"]
    }[page] || [];
    const data = Object.fromEntries(await Promise.all(resources.map(async resource => [resource, await loadResource(resource)])));
    updateAlertsBadge(data.alerts || []);
    if (page === "dashboard") renderDashboard({ connections: data.connections, alerts: data.alerts, network: data.network });
    if (page === "users") renderUsers({ users: data.users, connections: data.connections });
    if (page === "alerts") renderAlerts(data.alerts);
    if (page === "reports") renderReports({ connections: data.connections, alerts: data.alerts });
    if (page === "locations") renderLocations({ connections: data.connections, servers: data.servers });
  } catch (error) {
    console.error("Erro ao carregar dados da API:", error);
    const message = "Não foi possível carregar os dados. Verifique se o JSON Server está rodando.";
    showTableMessage(document.getElementById("dashboard-connections"), message, 6);
    showTableMessage(document.getElementById("users-table"), message, 5);
    const alertList = document.getElementById("alert-list");
    if (alertList) alertList.textContent = message;
    const locationStatus = document.getElementById("location-map-status");
    if (locationStatus) locationStatus.textContent = message;
    const badge = document.getElementById("alerts-badge");
    if (badge) badge.textContent = "!";
  }
}

loadPage();
setInterval(loadPage, 15000);

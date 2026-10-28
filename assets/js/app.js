import { apiRequest, loadResource } from './api.js';
import { renderAlerts, renderBreakdown, renderDashboard, renderLocations, renderReports, renderUsers, renderConnectionRows, updateAlertsBadge } from './renderers.js';
import { escapeHtml, showTableMessage } from './utils.js';

const page = document.body?.dataset?.page;

async function loadPage() {
  try {
    if (page === "connections") {
      const alerts = await loadResource("alerts");
      updateAlertsBadge(alerts);
      initConnectionsPage();
      return;
    }

    const resourcesMap = {
      dashboard: ["connections", "alerts", "network"],
      users: ["users", "connections", "alerts"],
      alerts: ["alerts"],
      reports: ["connections", "alerts"],
      locations: ["connections", "servers", "alerts"]
    };

    const resources = resourcesMap[page] || [];
    const data = Object.fromEntries(await Promise.all(resources.map(async (resource) => [resource, await loadResource(resource)])));
    updateAlertsBadge(data.alerts || []);

    if (page === "dashboard") renderDashboard({ connections: data.connections, alerts: data.alerts, network: data.network || [] });
    if (page === "users") renderUsers({ users: data.users, connections: data.connections });
    if (page === "alerts") renderAlerts(data.alerts || []);
    if (page === "reports") renderReports({ connections: data.connections, alerts: data.alerts || [] });
    if (page === "locations") renderLocations({ connections: data.connections, servers: data.servers || [] });
  } catch (error) {
    console.error("Erro ao carregar dados da API:", error);
    const message = "Não foi possível carregar os dados. Verifique se o JSON Server está rodando.";
    const dashboard = document.getElementById("dashboard-connections");
    const usersTable = document.getElementById("users-table");
    const alertList = document.getElementById("alert-list");
    const locationStatus = document.getElementById("location-map-status");
    const badge = document.getElementById("alerts-badge");

    if (dashboard) showTableMessage(dashboard, message, 6);
    if (usersTable) showTableMessage(usersTable, message, 5);
    if (alertList) alertList.textContent = message;
    if (locationStatus) locationStatus.textContent = message;
    if (badge) badge.textContent = "!";
  }
}

function initConnectionsPage() {
  const table = document.getElementById("connections-table");
  const field = document.getElementById("search-input");
  const statusFilter = document.getElementById("status-filter");

  if (!table || !field || !statusFilter) return;

  let connections = [];

  const renderConnections = () => {
    const query = field.value.trim().toLocaleLowerCase("pt-BR");
    const selectedStatus = statusFilter.value;

    const filteredConnections = connections.filter((connection) => {
      const matchesSearch = [connection.user, connection.sourceIp, connection.vpnIp]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query));
      const matchesStatus = selectedStatus === "all" || connection.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    if (!filteredConnections.length) {
      showTableMessage(table, "Nenhuma conexão encontrada.", 7);
      return;
    }

    table.innerHTML = "";
    filteredConnections.forEach((connection) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(connection.user || "--")}</td>
        <td>${escapeHtml(connection.sourceIp || "--")}</td>
        <td>${escapeHtml(connection.vpnIp || "--")}</td>
        <td>${escapeHtml(connection.protocol || "--")}</td>
        <td>${escapeHtml(connection.duration || "--")}</td>
        <td>${escapeHtml(connection.traffic || "--")}</td>
        <td>${connection.status === "active" ? '<span class="tag success">Ativo</span>' : connection.status === "alert" ? '<span class="tag warning">Alerta</span>' : '<span class="tag neutral">Offline</span>'}</td>
      `;
      table.appendChild(row);
    });
  };

  field.addEventListener("input", renderConnections);
  statusFilter.addEventListener("change", renderConnections);

  const loadConnections = async () => {
    table.innerHTML = '<tr><td colspan="7">Carregando conexões...</td></tr>';
    try {
      connections = await loadResource("connections");
      renderConnections();
    } catch (error) {
      console.error("Erro ao carregar conexões:", error);
      table.innerHTML = '<tr><td colspan="7">Não foi possível carregar os dados.<br>Verifique se o JSON Server está rodando.</td></tr>';
    }
  };

  loadConnections();
}

function initLoginForm() {
  const form = document.querySelector(".login-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("email");
    const password = document.getElementById("password");

    if (!email?.value || !password?.value) {
      window.alert("Informe o e-mail e a senha para entrar.");
      return;
    }

    window.location.href = "dashboard.html";
  });
}

if (page === "login") {
  initLoginForm();
}

loadPage();
if (page !== "connections") {
  setInterval(loadPage, 15000);
}

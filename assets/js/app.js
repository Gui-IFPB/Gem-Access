import { apiRequest, clearAuthToken, getAuthToken, loadResource, login, logout } from './api.js';
import { renderAlerts, renderBreakdown, renderDashboard, renderLocations, renderReports, renderUsers, renderConnectionRows, updateAlertsBadge } from './renderers.js';
import { escapeHtml, showTableMessage } from './utils.js';

const page = document.body?.dataset?.page;

function showApiError(error) {
  const content = document.querySelector(".content");
  if (!content) return;

  let banner = document.getElementById("api-error");
  if (!banner) {
    banner = document.createElement("p");
    banner.id = "api-error";
    banner.className = "api-error";
    banner.setAttribute("role", "alert");
    content.prepend(banner);
  }
  banner.textContent = error instanceof Error ? error.message : "Não foi possível carregar os dados.";
}

async function loadPage() {
  if (page === "login") return;
  if (!getAuthToken()) {
    window.location.replace("index.html");
    return;
  }

  try {
    if (page === "connections") {
      initConnectionsPage();
      const alerts = await loadResource("alerts");
      updateAlertsBadge(alerts);
      document.getElementById("api-error")?.remove();
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
    document.getElementById("api-error")?.remove();
  } catch (error) {
    console.error("Erro ao carregar dados da API:", error);
    if (error?.status === 401) {
      window.location.replace("index.html");
      return;
    }
    const message = error instanceof Error ? error.message : "Não foi possível carregar os dados.";
    showApiError(error);
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
  const form = document.getElementById("connection-form");
  const message = document.getElementById("connection-message");

  if (!table || !field || !statusFilter || !form || !message) return;

  let connections = [];
  let editingConnectionId = null;

  const setMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle("form-message-error", isError);
  };

  const resetConnectionForm = () => {
    form.reset();
    editingConnectionId = null;
    document.getElementById("connection-form-title").textContent = "Cadastrar conexão";
    document.getElementById("connection-submit").textContent = "Cadastrar conexão";
    setMessage("");
  };

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
      showTableMessage(table, "Nenhuma conexão encontrada.", 8);
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
        <td class="row-actions">
          <button type="button" class="btn btn-small" data-action="edit" data-id="${escapeHtml(String(connection.id))}">Editar</button>
          <button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="${escapeHtml(String(connection.id))}">Excluir</button>
        </td>
      `;
      table.appendChild(row);
    });
  };

  field.addEventListener("input", renderConnections);
  statusFilter.addEventListener("change", renderConnections);
  document.getElementById("connection-cancel").addEventListener("click", resetConnectionForm);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = {
      user: document.getElementById("connection-user").value.trim(),
      sourceIp: document.getElementById("connection-source-ip").value.trim(),
      vpnIp: document.getElementById("connection-vpn-ip").value.trim(),
      protocol: document.getElementById("connection-protocol").value,
      duration: document.getElementById("connection-duration").value.trim(),
      traffic: document.getElementById("connection-traffic").value.trim(),
      status: document.getElementById("connection-status").value,
      serverId: 1
    };

    try {
      if (editingConnectionId === null) {
        await apiRequest("connections", { method: "POST", body });
        resetConnectionForm();
        setMessage("Conexão cadastrada.");
      } else {
        await apiRequest(`connections/${encodeURIComponent(editingConnectionId)}`, { method: "PATCH", body });
        resetConnectionForm();
        setMessage("Conexão atualizada.");
      }

      await loadConnections();
    } catch (error) {
      console.error("Erro ao salvar conexão:", error);
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a conexão.", true);
    }
  });

  table.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button[data-action]");
    if (!button) return;

    const connection = connections.find((item) => String(item.id) === button.dataset.id);
    if (!connection) return;

    if (button.dataset.action === "edit") {
      editingConnectionId = connection.id;
      document.getElementById("connection-user").value = connection.user || "";
      document.getElementById("connection-source-ip").value = connection.sourceIp || "";
      document.getElementById("connection-vpn-ip").value = connection.vpnIp || "";
      document.getElementById("connection-protocol").value = connection.protocol || "OpenVPN";
      document.getElementById("connection-duration").value = connection.duration || "";
      document.getElementById("connection-traffic").value = connection.traffic || "";
      document.getElementById("connection-status").value = connection.status || "active";
      document.getElementById("connection-form-title").textContent = "Editar conexão";
      document.getElementById("connection-submit").textContent = "Salvar alterações";
      setMessage("");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (button.dataset.action === "delete" && window.confirm(`Excluir a conexão de ${connection.user || "usuário"}?`)) {
      try {
        await apiRequest(`connections/${encodeURIComponent(connection.id)}`, { method: "DELETE" });
        if (editingConnectionId === connection.id) resetConnectionForm();
        setMessage("Conexão excluída.");
        await loadConnections();
      } catch (error) {
        console.error("Erro ao excluir conexão:", error);
        setMessage(error instanceof Error ? error.message : "Não foi possível excluir a conexão.", true);
      }
    }
  });

  const loadConnections = async () => {
    table.innerHTML = '<tr><td colspan="8">Carregando conexões...</td></tr>';
    try {
      connections = await loadResource("connections");
      renderConnections();
    } catch (error) {
      console.error("Erro ao carregar conexões:", error);
      if (error?.status === 401) {
        window.location.replace("index.html");
        return;
      }
      showTableMessage(table, error instanceof Error ? error.message : "Não foi possível carregar as conexões.", 8);
    }
  };

  loadConnections();
  setInterval(loadConnections, 15000);
}

function initLoginForm() {
  const form = document.querySelector(".login-form");
  if (!form) return;
  if (getAuthToken()) {
    window.location.replace("dashboard.html");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const message = document.getElementById("login-message");
    const submit = form.querySelector('button[type="submit"]');

    if (!email?.value.trim() || !password?.value) {
      message.textContent = "Informe o e-mail e a senha para entrar.";
      return;
    }

    submit.disabled = true;
    message.classList.remove("form-message-error");
    message.textContent = "Validando acesso...";
    try {
      await login(email.value.trim(), password.value);
      window.location.assign("dashboard.html");
    } catch (error) {
      message.classList.add("form-message-error");
      message.textContent = error instanceof Error ? error.message : "Não foi possível entrar.";
    } finally {
      submit.disabled = false;
    }
  });
}

function initLogout() {
  document.querySelectorAll('.sidebar-bottom a[href="index.html"]').forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await logout();
      } catch (error) {
        console.error("Erro ao encerrar sessão na API:", error);
        clearAuthToken();
      }
      window.location.assign("index.html");
    });
  });
}

if (page === "login") {
  initLoginForm();
} else {
  initLogout();
}

loadPage();
if (page !== "connections" && page !== "login") {
  setInterval(loadPage, 15000);
}

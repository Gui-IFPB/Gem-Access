import { apiRequest, clearAuthToken, getAuthToken, getAuthUser, isAdministrator, loadResource, login, logout, register } from './api.js';
import { renderAlerts, renderBreakdown, renderDashboard, renderLocations, renderReports, renderUsers, renderConnectionRows, updateAlertsBadge } from './renderers.js';
import { escapeHtml, showTableMessage } from './utils.js';

const page = document.body?.dataset?.page;

function applyAdministratorUi() {
  if (isAdministrator()) return;
  document.querySelectorAll(".alert-form, #connection-form").forEach((form) => {
    form.hidden = true;
  });
  document.querySelectorAll(".row-actions").forEach((actions) => {
    actions.querySelectorAll("button").forEach((button) => {
      button.hidden = true;
    });
  });
  document.querySelectorAll("[data-action='edit'], [data-action='delete'], [data-alert-action='edit'], [data-alert-action='delete']").forEach((button) => {
    button.hidden = true;
  });
}

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

  const user = getAuthUser();
  const userChip = document.querySelector(".user-chip");
  if (userChip && user) {
    userChip.lastChild.textContent = ` ${user.name || user.role || "Usuário"}`;
  }
  applyAdministratorUi();

  try {
    if (page === "connections") {
      initConnectionsPage();
      const alerts = await loadResource("alerts");
      updateAlertsBadge(alerts);
      document.getElementById("api-error")?.remove();
      return;
    }

    if (page === "alerts") {
      initAlertsPage();
      const alerts = await loadResource("alerts");
      renderAlerts(alerts);
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

function initAlertsPage() {
  const form = document.getElementById("alert-form");
  const list = document.getElementById("alert-list");
  const message = document.getElementById("alert-message");
  const submit = document.getElementById("alert-submit");
  if (!form || !list || !message) return;
  if (form.dataset.initialized === "true") return;
  form.dataset.initialized = "true";

  let alerts = [];
  let editingAlertId = null;

  const setMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle("form-message-error", isError);
  };

  const resetForm = () => {
    form.reset();
    editingAlertId = null;
    document.getElementById("alert-form-title").textContent = "Cadastrar alerta";
    document.getElementById("alert-submit").textContent = "Cadastrar alerta";
    setMessage("");
  };

  const loadAlerts = async () => {
    try {
      alerts = await loadResource("alerts");
      renderAlerts(alerts);
      updateAlertsBadge(alerts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os alertas.", true);
    }
  };

  document.getElementById("alert-cancel").addEventListener("click", resetForm);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    const body = {
      title: document.getElementById("alert-title").value.trim(),
      description: document.getElementById("alert-description").value.trim(),
      severity: document.getElementById("alert-severity").value,
      time: document.getElementById("alert-time").value.trim(),
      status: document.getElementById("alert-status").value
    };

    try {
      if (editingAlertId === null) {
        await apiRequest("alerts", { method: "POST", body });
        resetForm();
        setMessage("Alerta cadastrado.");
      } else {
        await apiRequest(`alerts/${encodeURIComponent(editingAlertId)}`, { method: "PATCH", body });
        resetForm();
        setMessage("Alerta atualizado.");
      }
      await loadAlerts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o alerta.", true);
    } finally {
      submit.disabled = false;
    }
  });

  list.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button[data-alert-action]");
    if (!button) return;

    const alert = alerts.find((item) => String(item.id) === button.dataset.id);
    if (!alert) return;

    if (button.dataset.alertAction === "edit") {
      editingAlertId = alert.id;
      document.getElementById("alert-title").value = alert.title || "";
      document.getElementById("alert-description").value = alert.description || "";
      document.getElementById("alert-severity").value = alert.severity || "medium";
      document.getElementById("alert-time").value = alert.time || "";
      document.getElementById("alert-status").value = alert.status || "active";
      document.getElementById("alert-form-title").textContent = "Editar alerta";
      document.getElementById("alert-submit").textContent = "Salvar alterações";
      setMessage("");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (button.dataset.alertAction === "delete" && window.confirm(`Excluir o alerta "${alert.title}"?`)) {
      try {
        await apiRequest(`alerts/${encodeURIComponent(alert.id)}`, { method: "DELETE" });
        if (editingAlertId === alert.id) resetForm();
        setMessage("Alerta excluído.");
        await loadAlerts();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível excluir o alerta.", true);
      }
    }
  });

  loadAlerts();
}

function initConnectionsPage() {
  const table = document.getElementById("connections-table");
  const field = document.getElementById("search-input");
  const statusFilter = document.getElementById("status-filter");
  const form = document.getElementById("connection-form");
  const message = document.getElementById("connection-message");
  const submit = document.getElementById("connection-submit");

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
    submit.disabled = true;
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
    } finally {
      submit.disabled = false;
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

  const name = document.getElementById("name");
  const modeToggle = document.getElementById("auth-mode-toggle");
  const submit = form.querySelector('button[type="submit"]');
  const setMode = (mode) => {
    const isRegister = mode === "register";
    form.dataset.mode = mode;
    name.hidden = !isRegister;
    name.required = isRegister;
    document.getElementById("password").autocomplete = isRegister ? "new-password" : "current-password";
    submit.textContent = isRegister ? "Criar conta" : "Entrar";
    modeToggle.textContent = isRegister ? "Já tenho uma conta" : "Criar conta";
    document.getElementById("login-message").textContent = "";
  };
  modeToggle.addEventListener("click", () => setMode(form.dataset.mode === "register" ? "login" : "register"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nameInput = document.getElementById("name");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const message = document.getElementById("login-message");
    const isRegister = form.dataset.mode === "register";

    if (!email?.value.trim() || !password?.value || (isRegister && !nameInput?.value.trim())) {
      message.textContent = isRegister ? "Informe seu nome, e-mail e senha." : "Informe o e-mail e a senha para entrar.";
      return;
    }
    if (isRegister && password.value.length < 10) {
      message.textContent = "A senha deve ter pelo menos 10 caracteres.";
      return;
    }

    submit.disabled = true;
    message.classList.remove("form-message-error");
    message.textContent = isRegister ? "Criando sua conta..." : "Validando acesso...";
    try {
      if (isRegister) await register(nameInput.value.trim(), email.value.trim(), password.value);
      else await login(email.value.trim(), password.value);
      window.location.assign("dashboard.html");
    } catch (error) {
      message.classList.add("form-message-error");
      message.textContent = error instanceof Error ? error.message : "Não foi possível entrar.";
    } finally {
      submit.disabled = false;
    }
  });
  setMode("login");
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

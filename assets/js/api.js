export const API_BASE_URL = "http://localhost:3000";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getAuthToken() {
  return globalThis.sessionStorage?.getItem("gem-access-token") || "";
}

export function clearAuthToken() {
  globalThis.sessionStorage?.removeItem("gem-access-token");
}

export async function apiRequest(resource, options = {}) {
  const { method = "GET", body, headers = {}, authenticated = true } = options;
  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  const token = authenticated ? getAuthToken() : "";
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/${resource}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw new ApiError("Não foi possível conectar à API. Verifique se o servidor está ativo e tente novamente.");
  }

  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (response.status === 401) clearAuthToken();
    throw new ApiError(
      payload?.error?.message || `A API retornou um erro (${response.status}).`,
      response.status,
      payload?.error?.code
    );
  }

  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch (error) {
    throw new ApiError("A API retornou uma resposta inválida.");
  }
}

export async function loadResource(resource) {
  return apiRequest(resource, { method: "GET" });
}

export async function login(email, password) {
  const result = await apiRequest("auth/login", {
    method: "POST",
    body: { email, password },
    authenticated: false
  });
  if (typeof result?.token !== "string" || !result.token) {
    throw new ApiError("A API não retornou uma sessão válida.");
  }
  globalThis.sessionStorage?.setItem("gem-access-token", result.token);
  return result.user;
}

export async function register(name, email, password) {
  const result = await apiRequest("auth/register", {
    method: "POST",
    body: { name, email, password },
    authenticated: false
  });
  if (typeof result?.token !== "string" || !result.token) {
    throw new ApiError("A API não retornou uma sessão válida.");
  }
  globalThis.sessionStorage?.setItem("gem-access-token", result.token);
  return result.user;
}

export async function logout() {
  try {
    if (getAuthToken()) {
      await apiRequest("auth/logout", { method: "POST" });
    }
  } finally {
    clearAuthToken();
  }
}

export const API_BASE_URL = "http://localhost:3000";

export async function apiRequest(resource, options = {}) {
  const { method = "GET", body, headers = {} } = options;
  const response = await fetch(`${API_BASE_URL}/${resource}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`Falha na requisição para ${resource}: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function loadResource(resource) {
  return apiRequest(resource, { method: "GET" });
}

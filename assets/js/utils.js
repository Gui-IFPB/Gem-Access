export const API_BASE_URL = "http://localhost:3000";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

export function showTableMessage(table, message, columns) {
  if (!table) return;
  table.innerHTML = `<tr><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

export function trafficToMb(traffic) {
  const match = String(traffic || "").match(/([\d.,]+)\s*(B|KB|MB|GB|TB)?/i);
  if (!match) return 0;
  const amount = Number(match[1].replace(",", "."));
  const unit = (match[2] || "MB").toUpperCase();
  const factors = { B: 1 / 1000000, KB: 1 / 1000, MB: 1, GB: 1000, TB: 1000000 };
  return amount * (factors[unit] || 1);
}

export function formatTraffic(mb) {
  if (mb >= 1000) {
    return `${(mb / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
  }
  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} MB`;
}

export function durationToSeconds(duration) {
  const parts = String(duration || "").split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}`;
}

export function statusTag(status) {
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

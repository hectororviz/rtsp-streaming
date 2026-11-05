const API = (import.meta.env.VITE_API_BASE || "https://api.streaming.csdsoler.com.ar").replace(/\/$/, "");

async function req(path, opts = {}) {
  const r = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || `HTTP ${r.status}`), { status: r.status, body });
  return body;
}

export const api = {
  current: () => req("/api/matches/current"),
  list: () => req("/api/matches"),
  access: (matchId, pin) =>
    req("/api/access", { method: "POST", body: JSON.stringify({ matchId, pin }) }),
  me: (matchId) => req(`/api/me?matchId=${matchId}`),
  stream: (matchId) => req(`/api/matches/${matchId}/stream`),
  adminList: (token) => req("/api/admin/matches", { headers: { "x-admin-token": token } }),
  adminCreate: (token, data) =>
    req("/api/admin/matches", { method: "POST", headers: { "x-admin-token": token }, body: JSON.stringify(data) }),
  adminUpdate: (token, id, data) =>
    req(`/api/admin/matches/${id}`, { method: "PATCH", headers: { "x-admin-token": token }, body: JSON.stringify(data) }),
  adminDelete: (token, id) =>
    req(`/api/admin/matches/${id}`, { method: "DELETE", headers: { "x-admin-token": token } }),
};

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

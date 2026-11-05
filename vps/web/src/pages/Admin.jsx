import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";
import Player from "../Player";

const LS_KEY = "soler_admin_token";

function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) {
  return new Date(v).toISOString();
}

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem(LS_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [previewKey, setPreviewKey] = useState("");

  async function login(ev) {
    ev?.preventDefault();
    setError("");
    try {
      const list = await api.adminList(token.trim());
      setItems(list);
      localStorage.setItem(LS_KEY, token.trim());
      setAuthed(true);
    } catch {
      setError("Token inválido.");
    }
  }

  async function refresh() {
    try {
      setItems(await api.adminList(token.trim()));
    } catch {
      setError("Sesión vencida, ingresá el token de nuevo.");
      setAuthed(false);
    }
  }

  useEffect(() => {
    if (token) login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(ev) {
    ev.preventDefault();
    setError("");
    const fd = new FormData(ev.target);
    const data = {
      title: fd.get("title") || undefined,
      rival: fd.get("rival"),
      starts_at: fromLocalInput(fd.get("starts_at")),
      ends_at: fromLocalInput(fd.get("ends_at")),
      stream_key: fd.get("stream_key"),
    };
    const pin = (fd.get("pin") || "").trim();
    if (pin) data.pin = pin;
    try {
      if (editing?.id) await api.adminUpdate(token.trim(), editing.id, data);
      else {
        if (!pin) {
          setError("El PIN es obligatorio al crear.");
          return;
        }
        await api.adminCreate(token.trim(), data);
      }
      setEditing(null);
      ev.target.reset();
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!authed) {
    return (
      <div className="wrap narrow">
        <div className="admin-topbar">
          <a href="/">← Volver al sitio</a>
        </div>
        <h1>Backoffice</h1>
        <form className="pin-card" onSubmit={login}>
          <h2>Token de administrador</h2>
          <div className="pin-row">
            <input className="input--token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" autoComplete="off" aria-label="Token de administrador" />
            <button className="btn btn--red" type="submit">Entrar</button>
          </div>
          {error && <div className="field-error">{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="wrap wide">
      <div className="admin-topbar">
        <a href="/">← Volver al sitio</a>
      </div>
      <div className="admin-head">
        <h1>Partidos</h1>
        <button className="linklike" onClick={() => { localStorage.removeItem(LS_KEY); setAuthed(false); setToken(""); }}>
          Salir
        </button>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr><th>Partido</th><th>Inicio</th><th>Fin</th><th>Key</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td>{m.title} <small>vs {m.rival}</small></td>
              <td>{fmtDate(m.starts_at)}</td>
              <td>{fmtDate(m.ends_at)}</td>
              <td><code>{m.stream_key}</code></td>
              <td>{m.status}</td>
              <td className="row-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setEditing(m)}>Editar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setPreviewKey(m.stream_key)}>Preview</button>
                <button className="btn btn--danger btn--sm" onClick={async () => { if (confirm("¿Eliminar?")) { await api.adminDelete(token.trim(), m.id); refresh(); } }}>
                  Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <h2>{editing ? `Editar #${editing.id}` : "Nuevo partido"}</h2>
      <form className="form-grid" onSubmit={save} key={editing?.id || "new"}>
        <label>Título<input name="title" defaultValue={editing?.title || ""} placeholder="CSD Soler vs …" /></label>
        <label>Rival*<input name="rival" required defaultValue={editing?.rival || ""} /></label>
        <label>Inicio*<input name="starts_at" type="datetime-local" required defaultValue={editing ? toLocalInput(editing.starts_at) : ""} /></label>
        <label>Fin*<input name="ends_at" type="datetime-local" required defaultValue={editing ? toLocalInput(editing.ends_at) : ""} /></label>
        <label>Stream key*<input name="stream_key" required defaultValue={editing?.stream_key || "test"} /></label>
        <label>PIN {editing ? "(vacío = no cambia)" : "*"}<input name="pin" type="text" autoComplete="off" placeholder={editing ? "••••" : "1234"} /></label>
        <div className="form-actions">
          <button className="btn btn--red" type="submit">Guardar</button>
          {editing && <button type="button" className="linklike" onClick={() => setEditing(null)}>Cancelar</button>}
        </div>
      </form>

      {previewKey && (
        <div>
          <h2>Preview (requiere PIN del partido en otra pestaña)</h2>
          <p className="muted">La preview usa el HLS público del path <code>live/{previewKey}</code>: sirve para verificar que el puente está publicando.</p>
          <PreviewPlayer streamKey={previewKey} />
        </div>
      )}
    </div>
  );
}

function PreviewPlayer({ streamKey }) {
  // Preview directa del path HLS: verifica que el puente este publicando.
  const src = `https://hls.streaming.csdsoler.com.ar/live/${streamKey}/index.m3u8`;
  return <Player src={src} />;
}
